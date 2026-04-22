import datetime
from sqlalchemy.orm import Session
from ..models.kitchen import DishTimeLog


def get_all_dish_times(db: Session, user_id: int):
    return db.query(DishTimeLog).filter(DishTimeLog.user_id == user_id).order_by(DishTimeLog.date.desc()).all()


def create_dish_time(db: Session, user_id: int, data: dict) -> DishTimeLog:
    entry = DishTimeLog(
        user_id=user_id,
        item_name=data["item_name"],
        staff_name=data["staff_name"],
        prep_minutes=data["prep_minutes"],
        cook_minutes=data["cook_minutes"],
        date=datetime.date.today(),
        notes=data.get("notes", ""),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def delete_dish_time(db: Session, user_id: int, log_id: int) -> bool:
    entry = db.query(DishTimeLog).filter(DishTimeLog.id == log_id, DishTimeLog.user_id == user_id).first()
    if not entry:
        return False
    db.delete(entry)
    db.commit()
    return True


def get_kitchen_summary(db: Session, user_id: int) -> dict:
    logs = db.query(DishTimeLog).filter(DishTimeLog.user_id == user_id).all()
    if not logs:
        return {"avg_total_minutes": 0, "by_staff": [], "by_dish": [], "slowest_dish": None, "fastest_staff": None}

    by_staff: dict[str, list] = {}
    by_dish: dict[str, list] = {}

    for l in logs:
        total = l.prep_minutes + l.cook_minutes
        if l.staff_name not in by_staff:
            by_staff[l.staff_name] = []
        by_staff[l.staff_name].append(total)

        if l.item_name not in by_dish:
            by_dish[l.item_name] = []
        by_dish[l.item_name].append(total)

    staff_list = sorted(
        [{"name": k, "avg_minutes": round(sum(v) / len(v), 1), "entries": len(v)} for k, v in by_staff.items()],
        key=lambda x: x["avg_minutes"],
    )
    dish_list = sorted(
        [{"name": k, "avg_minutes": round(sum(v) / len(v), 1), "entries": len(v)} for k, v in by_dish.items()],
        key=lambda x: x["avg_minutes"], reverse=True,
    )

    all_totals = [l.prep_minutes + l.cook_minutes for l in logs]
    return {
        "avg_total_minutes": round(sum(all_totals) / len(all_totals), 1),
        "by_staff": staff_list,
        "by_dish": dish_list[:10],
        "slowest_dish": dish_list[0]["name"] if dish_list else None,
        "fastest_staff": staff_list[0]["name"] if staff_list else None,
    }
