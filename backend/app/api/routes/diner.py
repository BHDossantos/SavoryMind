from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...services import diner_service

router = APIRouter(prefix="/diner", tags=["diner"])


def require_diner(user: User = Depends(get_current_user)) -> User:
    if user.account_type != "diner":
        raise HTTPException(status_code=403, detail="Diner accounts only.")
    return user


# ── Bookings ──────────────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    restaurant_name: str = Field(min_length=1, max_length=150)
    booking_date: str = Field(min_length=8, max_length=20)
    booking_time: str = Field(default="19:00", max_length=10)
    party_size: int = Field(default=2, ge=1, le=20)
    special_requests: Optional[str] = Field(default="", max_length=500)


@router.get("/bookings")
def list_bookings(db: Session = Depends(get_db), user: User = Depends(require_diner)):
    return diner_service.get_bookings(db, user.id)


@router.post("/bookings", status_code=201)
def create_booking(body: BookingCreate, db: Session = Depends(get_db), user: User = Depends(require_diner)):
    return diner_service.create_booking(db, user.id, body.model_dump())


@router.patch("/bookings/{booking_id}/cancel", status_code=200)
def cancel_booking(booking_id: int, db: Session = Depends(get_db), user: User = Depends(require_diner)):
    if not diner_service.cancel_booking(db, user.id, booking_id):
        raise HTTPException(status_code=404, detail="Booking not found.")
    return {"status": "cancelled"}


# ── Visits ────────────────────────────────────────────────────────────────────

class VisitCreate(BaseModel):
    restaurant_name: str = Field(min_length=1, max_length=150)
    visit_date: Optional[str] = None
    items_ordered: Optional[str] = Field(default="", max_length=1000)
    overall_rating: float = Field(default=5.0, ge=1, le=5)
    food_rating: float = Field(default=5.0, ge=1, le=5)
    staff_rating: float = Field(default=5.0, ge=1, le=5)
    would_return: bool = True
    highlights: Optional[str] = Field(default="", max_length=500)
    lowlights: Optional[str] = Field(default="", max_length=500)
    notes: Optional[str] = Field(default="", max_length=1000)


@router.get("/visits")
def list_visits(db: Session = Depends(get_db), user: User = Depends(require_diner)):
    return diner_service.get_visits(db, user.id)


@router.post("/visits", status_code=201)
def create_visit(body: VisitCreate, db: Session = Depends(get_db), user: User = Depends(require_diner)):
    return diner_service.create_visit(db, user.id, body.model_dump())


@router.delete("/visits/{visit_id}", status_code=204)
def delete_visit(visit_id: int, db: Session = Depends(get_db), user: User = Depends(require_diner)):
    if not diner_service.delete_visit(db, user.id, visit_id):
        raise HTTPException(status_code=404, detail="Visit not found.")


@router.get("/summary")
def diner_summary(db: Session = Depends(get_db), user: User = Depends(require_diner)):
    return diner_service.get_diner_summary(db, user.id)
