import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.kitchen import FoodWasteLog


def get_all_waste(db: Session, user_id: int):
    return db.query(FoodWasteLog).filter(FoodWasteLog.user_id == user_id).order_by(FoodWasteLog.date.desc()).all()


def create_waste_log(db: Session, user_id: int, data: dict) -> FoodWasteLog:
    entry = FoodWasteLog(
        user_id=user_id,
        item_name=data["item_name"],
        staff_name=data["staff_name"],
        quantity_kg=data["quantity_kg"],
        estimated_cost=data["estimated_cost"],
        reason=data.get("reason", ""),
        date=datetime.date.today(),
        notes=data.get("notes", ""),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def delete_waste_log(db: Session, user_id: int, log_id: int) -> bool:
    entry = db.query(FoodWasteLog).filter(FoodWasteLog.id == log_id, FoodWasteLog.user_id == user_id).first()
    if not entry:
        return False
    db.delete(entry)
    db.commit()
    return True


def get_waste_summary(db: Session, user_id: int) -> dict:
    logs = db.query(FoodWasteLog).filter(FoodWasteLog.user_id == user_id).all()
    if not logs:
        return {"total_cost": 0, "total_kg": 0, "by_staff": [], "by_item": [], "by_reason": [], "entries": 0}

    total_cost = sum(l.estimated_cost for l in logs)
    total_kg = sum(l.quantity_kg for l in logs)

    by_staff: dict[str, dict] = {}
    by_item: dict[str, dict] = {}
    by_reason: dict[str, float] = {}

    for l in logs:
        if l.staff_name not in by_staff:
            by_staff[l.staff_name] = {"name": l.staff_name, "total_cost": 0, "total_kg": 0, "incidents": 0}
        by_staff[l.staff_name]["total_cost"] += l.estimated_cost
        by_staff[l.staff_name]["total_kg"] += l.quantity_kg
        by_staff[l.staff_name]["incidents"] += 1

        if l.item_name not in by_item:
            by_item[l.item_name] = {"name": l.item_name, "total_cost": 0, "total_kg": 0}
        by_item[l.item_name]["total_cost"] += l.estimated_cost
        by_item[l.item_name]["total_kg"] += l.quantity_kg

        reason = l.reason or "Unspecified"
        by_reason[reason] = by_reason.get(reason, 0) + l.estimated_cost

    staff_list = sorted(by_staff.values(), key=lambda x: x["total_cost"], reverse=True)
    item_list = sorted(by_item.values(), key=lambda x: x["total_cost"], reverse=True)
    reason_list = [{"reason": k, "cost": v} for k, v in sorted(by_reason.items(), key=lambda x: x[1], reverse=True)]

    return {
        "total_cost": round(total_cost, 2),
        "total_kg": round(total_kg, 2),
        "entries": len(logs),
        "by_staff": staff_list[:10],
        "by_item": item_list[:10],
        "by_reason": reason_list,
    }
