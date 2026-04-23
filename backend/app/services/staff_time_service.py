from datetime import datetime
from sqlalchemy.orm import Session
from ..models.kitchen import StaffTimeLog


def _compute_total_hours(clock_in: str, clock_out: str, break_minutes: int) -> float:
    fmt = "%H:%M"
    t_in = datetime.strptime(clock_in, fmt)
    t_out = datetime.strptime(clock_out, fmt)
    diff_hours = (t_out - t_in).total_seconds() / 3600
    total = diff_hours - (break_minutes / 60)
    return round(max(total, 0), 2)


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

    total_logs = len(logs)
    avg_hours_per_shift = round(sum(l.total_hours for l in logs) / total_logs, 1)
    overtime_shifts = sum(1 for l in logs if l.total_hours > 8)

    by_staff: dict[str, dict] = {}
    for l in logs:
        if l.staff_name not in by_staff:
            by_staff[l.staff_name] = {"total_hours": 0.0, "shifts": 0}
        by_staff[l.staff_name]["total_hours"] += l.total_hours
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
