from sqlalchemy.orm import Session
from ..models.consumer import MealMemory


def get_memories(db: Session, user_id: int) -> list[MealMemory]:
    return db.query(MealMemory).filter(MealMemory.user_id == user_id).order_by(MealMemory.cooked_at.desc()).all()


def create_memory(db: Session, user_id: int, dish_name: str, emoji: str | None,
                  rating: int, notes: str | None, what_id_change: str | None,
                  cuisine: str | None, recipe_id: int | None) -> MealMemory:
    mem = MealMemory(
        user_id=user_id,
        dish_name=dish_name.strip(),
        emoji=emoji or "🍽️",
        rating=max(1, min(5, rating)),
        notes=notes,
        what_id_change=what_id_change,
        cuisine=cuisine,
        recipe_id=recipe_id,
    )
    db.add(mem)
    db.commit()
    db.refresh(mem)
    return mem


def delete_memory(db: Session, user_id: int, memory_id: int) -> bool:
    mem = db.query(MealMemory).filter(MealMemory.id == memory_id, MealMemory.user_id == user_id).first()
    if not mem:
        return False
    db.delete(mem)
    db.commit()
    return True
