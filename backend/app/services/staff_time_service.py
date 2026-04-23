from datetime import datetime, date as date_type
from sqlalchemy.orm import Session
from ..models.kitchen import StaffTimeLog


def _compute_total_hours(clock_in: str, clock_out: str, break_minutes: int) -> float:
    fmt = "%H:%M"
    t_in = datetime.strptime(clock_in, fmt)
    t_out = datetime.strptime(clock_out, fmt)
    diff_hours = (t_out - t_in).total_seconds() / 3600
    total = diff_hours - (break_minutes / 60)
    return round(max(total, 0), 2)


def clock_in(db: Session, employer_id: int, staff_user_id: int, staff_name: str, notes: str = "") -> StaffTimeLog:
    # Close any previously open entry for this staff member (safety guard)
    open_entry = (
        db.query(StaffTimeLog)
        .filter(StaffTimeLog.user_id == employer_id, StaffTimeLog.staff_user_id == staff_user_id, StaffTimeLog.is_open == True)
        .first()
    )
    if open_entry:
        return open_entry  # already clocked in — return existing

    now = datetime.utcnow()
    entry = StaffTimeLog(
        user_id=employer_id,
        staff_user_id=staff_user_id,
        staff_name=staff_name,
        date=now.strftime("%Y-%m-%d"),
        clock_in=now.strftime("%H:%M"),
        clock_out=None,
        break_minutes=0,
        total_hours=None,
        is_open=True,
        notes=notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def clock_out(db: Session, employer_id: int, staff_user_id: int, break_minutes: int = 0) -> StaffTimeLog:
    entry = (
        db.query(StaffTimeLog)
        .filter(StaffTimeLog.user_id == employer_id, StaffTimeLog.staff_user_id == staff_user_id, StaffTimeLog.is_open == True)
        .first()
    )
    if not entry:
        return None

    now = datetime.utcnow()
    clock_out_str = now.strftime("%H:%M")
    entry.clock_out = clock_out_str
    entry.break_minutes = break_minutes
    entry.total_hours = _compute_total_hours(entry.clock_in, clock_out_str, break_minutes)
    entry.is_open = False
    db.commit()
    db.refresh(entry)
    return entry


def get_open_entry(db: Session, employer_id: int, staff_user_id: int):
    return (
        db.query(StaffTimeLog)
        .filter(StaffTimeLog.user_id == employer_id, StaffTimeLog.staff_user_id == staff_user_id, StaffTimeLog.is_open == True)
        .first()
    )


def get_staff_own_logs(db: Session, employer_id: int, staff_user_id: int):
    return (
        db.query(StaffTimeLog)
        .filter(StaffTimeLog.user_id == employer_id, StaffTimeLog.staff_user_id == staff_user_id)
        .order_by(StaffTimeLog.date.desc())
        .all()
    )


def get_all_logs(db: Session, user_id: int):
    return (
        db.query(StaffTimeLog)
        .filter(StaffTimeLog.user_id == user_id)
        .order_by(StaffTimeLog.date.desc())
        .all()
    )


def create_log(db: Session, user_id: int, data: dict) -> StaffTimeLog:
    total_hours = _compute_total_hours(
        data["clock_in"], data["clock_out"], data.get("break_minutes", 0)
    )
    entry = StaffTimeLog(
        user_id=user_id,
        staff_name=data["staff_name"],
        date=data["date"],
        clock_in=data["clock_in"],
        clock_out=data["clock_out"],
        break_minutes=data.get("break_minutes", 0),
        total_hours=total_hours,
        notes=data.get("notes", ""),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def delete_log(db: Session, user_id: int, log_id: int) -> bool:
    entry = (
        db.query(StaffTimeLog)
        .filter(StaffTimeLog.id == log_id, StaffTimeLog.user_id == user_id)
        .first()
    )
    if not entry:
        return False
    db.delete(entry)
    db.commit()
    return True


def get_summary(db: Session, user_id: int) -> dict:
    logs = db.query(StaffTimeLog).filter(StaffTimeLog.user_id == user_id).all()
    if not logs:
        return {
            "total_logs": 0,
            "avg_hours_per_shift": 0.0,
            "by_staff": [],
            "overtime_shifts": 0,
        }

    closed = [l for l in logs if l.total_hours is not None]
    total_logs = len(logs)
    avg_hours_per_shift = round(sum(l.total_hours for l in closed) / len(closed), 1) if closed else 0.0
    overtime_shifts = sum(1 for l in closed if l.total_hours > 8)

    by_staff: dict[str, dict] = {}
    for l in logs:
        if l.staff_name not in by_staff:
            by_staff[l.staff_name] = {"total_hours": 0.0, "shifts": 0}
        by_staff[l.staff_name]["total_hours"] += l.total_hours or 0.0
        by_staff[l.staff_name]["shifts"] += 1

    by_staff_list = sorted(
        [
            {
                "staff_name": name,
                "total_hours": round(vals["total_hours"], 2),
                "shifts": vals["shifts"],
            }
            for name, vals in by_staff.items()
        ],
        key=lambda x: x["total_hours"],
        reverse=True,
    )

    return {
        "total_logs": total_logs,
        "avg_hours_per_shift": avg_hours_per_shift,
        "by_staff": by_staff_list,
        "overtime_shifts": overtime_shifts,
    }
