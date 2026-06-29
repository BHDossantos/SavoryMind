from sqlalchemy.orm import Session
from ..models.consumer import PantryItem


def get_pantry(db: Session, user_id: int) -> list[PantryItem]:
    return db.query(PantryItem).filter(PantryItem.user_id == user_id).order_by(PantryItem.added_at.desc()).all()


def add_item(db: Session, user_id: int, ingredient: str, quantity: str | None, category: str | None) -> PantryItem:
    item = PantryItem(user_id=user_id, ingredient=ingredient.strip(), quantity=quantity, category=category or "Other")
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def delete_item(db: Session, user_id: int, item_id: int) -> bool:
    item = db.query(PantryItem).filter(PantryItem.id == item_id, PantryItem.user_id == user_id).first()
    if not item:
        return False
    db.delete(item)
    db.commit()
    return True


def clear_pantry(db: Session, user_id: int) -> int:
    count = db.query(PantryItem).filter(PantryItem.user_id == user_id).delete()
    db.commit()
    return count
