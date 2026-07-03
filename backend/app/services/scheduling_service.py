"""Scheduling + time clock.

Wave D of the Restaurant OS. Two surfaces:

  Scheduling  — planned shifts on a weekly grid (CRUD + week view).
  Time clock  — clock in / out with optional break; punches pair into
                worked hours.

Worked hours from real punches also feed the workforce overtime detector
(see workforce_intelligence_service), replacing the shift-band estimate
once a restaurant actually uses the clock.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from ..models.restaurant_ext import Shift, Staff, TimePunch


class SchedulingError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


# --- Shifts -----------------------------------------------------------------

def _hours_between(start: str, end: str) -> float:
    """Duration in hours between two HH:MM strings. Overnight (end < start)
    wraps past midnight."""
    try:
        sh, sm = (int(x) for x in start.split(":"))
        eh, em = (int(x) for x in end.split(":"))
    except Exception:
        return 0.0
    s = sh * 60 + sm
    e = eh * 60 + em
    if e < s:
        e += 24 * 60
    return round((e - s) / 60.0, 2)


def create_shift(db: Session, user_id: int, *, staff_id: int, on_date: date,
                 start_time: str, end_time: str, role: str = "", notes: str = "") -> Shift:
    staff = db.query(Staff).filter(Staff.id == staff_id, Staff.user_id == user_id).first()
    if not staff:
        raise SchedulingError("Staff member not found.", status_code=404)
    s = Shift(
        user_id=user_id, staff_id=staff_id, date=on_date,
        start_time=start_time, end_time=end_time,
        role=(role or staff.role), notes=(notes or "").strip() or None,
    )
    db.add(s); db.commit(); db.refresh(s)
    return s


def update_shift(db: Session, user_id: int, shift_id: int, **fields) -> Optional[Shift]:
    s = db.query(Shift).filter(Shift.id == shift_id, Shift.user_id == user_id).first()
    if not s:
        return None
    for k in ("date", "start_time", "end_time", "role", "notes"):
        if k in fields and fields[k] is not None:
            setattr(s, k, fields[k])
    db.commit(); db.refresh(s)
    return s


def delete_shift(db: Session, user_id: int, shift_id: int) -> bool:
    s = db.query(Shift).filter(Shift.id == shift_id, Shift.user_id == user_id).first()
    if not s:
        return False
    db.delete(s); db.commit()
    return True


def week_schedule(db: Session, user_id: int, week_start: date) -> dict:
    """All shifts in the 7-day window starting week_start, grouped by day,
    with a per-staff hour total for the week."""
    week_end = week_start + timedelta(days=6)
    shifts = (
        db.query(Shift)
        .filter(Shift.user_id == user_id, Shift.date >= week_start, Shift.date <= week_end)
        .order_by(Shift.date, Shift.start_time)
        .all()
    )
    staff = {s.id: s for s in db.query(Staff).filter(Staff.user_id == user_id).all()}

    days: dict[str, list] = {str(week_start + timedelta(days=i)): [] for i in range(7)}
    staff_hours: dict[int, float] = {}
    for sh in shifts:
        hrs = _hours_between(sh.start_time, sh.end_time)
        staff_hours[sh.staff_id] = staff_hours.get(sh.staff_id, 0.0) + hrs
        days.setdefault(str(sh.date), []).append({
            "id": sh.id, "staff_id": sh.staff_id,
            "staff_name": staff.get(sh.staff_id).name if staff.get(sh.staff_id) else "—",
            "start_time": sh.start_time, "end_time": sh.end_time,
            "role": sh.role, "hours": hrs, "notes": sh.notes,
        })
    return {
        "week_start": str(week_start),
        "days": days,
        "staff_hours": [
            {"staff_id": sid, "staff_name": staff.get(sid).name if staff.get(sid) else "—",
             "hours": round(h, 2)}
            for sid, h in sorted(staff_hours.items(), key=lambda kv: kv[1], reverse=True)
        ],
    }


# --- Time clock -------------------------------------------------------------

def clock_in(db: Session, user_id: int, staff_id: int, *, now: datetime | None = None) -> TimePunch:
    staff = db.query(Staff).filter(Staff.id == staff_id, Staff.user_id == user_id).first()
    if not staff:
        raise SchedulingError("Staff member not found.", status_code=404)
    open_punch = _open_punch(db, user_id, staff_id)
    if open_punch:
        raise SchedulingError("Already clocked in.")
    p = TimePunch(user_id=user_id, staff_id=staff_id, clock_in=now or datetime.utcnow())
    db.add(p); db.commit(); db.refresh(p)
    return p


def clock_out(db: Session, user_id: int, staff_id: int, *, break_minutes: int = 0,
              now: datetime | None = None) -> TimePunch:
    p = _open_punch(db, user_id, staff_id)
    if not p:
        raise SchedulingError("Not clocked in.")
    p.clock_out = now or datetime.utcnow()
    p.break_minutes = max(0, int(break_minutes or 0))
    db.commit(); db.refresh(p)
    return p


def _open_punch(db: Session, user_id: int, staff_id: int) -> Optional[TimePunch]:
    return (
        db.query(TimePunch)
        .filter(TimePunch.user_id == user_id, TimePunch.staff_id == staff_id,
                TimePunch.clock_out.is_(None))
        .order_by(TimePunch.clock_in.desc())
        .first()
    )


def clock_status(db: Session, user_id: int) -> list[dict]:
    """Who's currently on the clock."""
    staff = {s.id: s for s in db.query(Staff).filter(Staff.user_id == user_id).all()}
    open_punches = (
        db.query(TimePunch)
        .filter(TimePunch.user_id == user_id, TimePunch.clock_out.is_(None))
        .all()
    )
    return [
        {"staff_id": p.staff_id,
         "staff_name": staff.get(p.staff_id).name if staff.get(p.staff_id) else "—",
         "clock_in": p.clock_in.isoformat()}
        for p in open_punches
    ]


def hours_last_7_days(db: Session, user_id: int, staff_id: int,
                      *, now: datetime | None = None) -> float:
    """Total worked hours (minus breaks) over the trailing 7 days from
    closed punches. Feeds the workforce overtime detector."""
    if now is None:
        now = datetime.utcnow()
    since = now - timedelta(days=7)
    punches = (
        db.query(TimePunch)
        .filter(TimePunch.user_id == user_id, TimePunch.staff_id == staff_id,
                TimePunch.clock_out.isnot(None), TimePunch.clock_in >= since)
        .all()
    )
    total = 0.0
    for p in punches:
        worked = (p.clock_out - p.clock_in).total_seconds() / 3600.0
        worked -= (p.break_minutes or 0) / 60.0
        total += max(0.0, worked)
    return round(total, 2)
