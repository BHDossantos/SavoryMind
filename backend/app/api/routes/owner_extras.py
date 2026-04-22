from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...services import waste_service, kitchen_service, training_service

router = APIRouter(prefix="/owner", tags=["owner-extras"])


def require_restaurant(user: User = Depends(get_current_user)) -> User:
    if user.account_type != "restaurant":
        raise HTTPException(status_code=403, detail="Restaurant accounts only.")
    return user


# ── Waste ─────────────────────────────────────────────────────────────────────

class WasteCreate(BaseModel):
    item_name: str = Field(min_length=1, max_length=100)
    staff_name: str = Field(min_length=1, max_length=100)
    quantity_kg: float = Field(gt=0)
    estimated_cost: float = Field(gt=0)
    reason: Optional[str] = Field(default="", max_length=200)
    notes: Optional[str] = Field(default="", max_length=500)


@router.get("/waste")
def list_waste(db: Session = Depends(get_db), user: User = Depends(require_restaurant)):
    return waste_service.get_all_waste(db, user.id)


@router.get("/waste/summary")
def waste_summary(db: Session = Depends(get_db), user: User = Depends(require_restaurant)):
    return waste_service.get_waste_summary(db, user.id)


@router.post("/waste", status_code=201)
def add_waste(body: WasteCreate, db: Session = Depends(get_db), user: User = Depends(require_restaurant)):
    return waste_service.create_waste_log(db, user.id, body.model_dump())


@router.delete("/waste/{log_id}", status_code=204)
def delete_waste(log_id: int, db: Session = Depends(get_db), user: User = Depends(require_restaurant)):
    if not waste_service.delete_waste_log(db, user.id, log_id):
        raise HTTPException(status_code=404, detail="Waste log not found.")


# ── Kitchen Times ─────────────────────────────────────────────────────────────

class DishTimeCreate(BaseModel):
    item_name: str = Field(min_length=1, max_length=100)
    staff_name: str = Field(min_length=1, max_length=100)
    prep_minutes: float = Field(ge=0)
    cook_minutes: float = Field(ge=0)
    notes: Optional[str] = Field(default="", max_length=500)


@router.get("/kitchen")
def list_dish_times(db: Session = Depends(get_db), user: User = Depends(require_restaurant)):
    return kitchen_service.get_all_dish_times(db, user.id)


@router.get("/kitchen/summary")
def kitchen_summary(db: Session = Depends(get_db), user: User = Depends(require_restaurant)):
    return kitchen_service.get_kitchen_summary(db, user.id)


@router.post("/kitchen", status_code=201)
def add_dish_time(body: DishTimeCreate, db: Session = Depends(get_db), user: User = Depends(require_restaurant)):
    return kitchen_service.create_dish_time(db, user.id, body.model_dump())


@router.delete("/kitchen/{log_id}", status_code=204)
def delete_dish_time(log_id: int, db: Session = Depends(get_db), user: User = Depends(require_restaurant)):
    if not kitchen_service.delete_dish_time(db, user.id, log_id):
        raise HTTPException(status_code=404, detail="Dish time log not found.")


# ── Training ──────────────────────────────────────────────────────────────────

@router.get("/training")
def get_training(db: Session = Depends(get_db), user: User = Depends(require_restaurant)):
    return training_service.get_training_recommendations(db, user.id)
