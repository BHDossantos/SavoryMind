from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...services import discover_service, booking_service

router = APIRouter(prefix="/discover", tags=["discover"])


# ── Public discovery ──────────────────────────────────────────────────────────

@router.get("/restaurants")
def list_restaurants(
    cuisine: str = "",
    city: str = "",
    mood: str = "",
    db: Session = Depends(get_db),
):
    return discover_service.get_restaurants(db, cuisine=cuisine, city=city, mood=mood)


@router.get("/restaurants/{restaurant_id}")
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    r = discover_service.get_restaurant(db, restaurant_id)
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found.")
    return r


@router.get("/availability/{restaurant_id}")
def get_availability(
    restaurant_id: int,
    check_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    d = check_date or date.today()
    return discover_service.get_availability(db, restaurant_id, d)


# ── Diner: request a booking ─────────────────────────────────────────────────

class BookingRequest(BaseModel):
    restaurant_id: int
    booking_date: str   # "YYYY-MM-DD"
    booking_time: str   # "19:00"
    party_size: int = 2
    special_requests: str = ""


@router.post("/book", status_code=201)
def request_booking(
    body: BookingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.account_type != "diner":
        raise HTTPException(status_code=403, detail="Diner account required.")
    diner_booking = booking_service.request_booking(
        db,
        diner_user_id=current_user.id,
        restaurant_user_id=body.restaurant_id,
        booking_date=body.booking_date,
        booking_time=body.booking_time,
        party_size=body.party_size,
        special_requests=body.special_requests,
    )
    return diner_booking


# ── Restaurant: manage availability ──────────────────────────────────────────

class AvailabilityUpdate(BaseModel):
    time_slots: list[str]           # ["12:00", "19:00", "20:00"]
    booking_window_days: int = 60


@router.get("/my-availability")
def get_my_availability(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.account_type != "restaurant":
        raise HTTPException(status_code=403, detail="Restaurant account required.")
    from ...services.discover_service import DEFAULT_SLOTS, _slots_for
    slots = _slots_for(current_user)
    return {
        "time_slots": slots,
        "booking_window_days": current_user.booking_window_days or 60,
        "is_custom": bool(current_user.available_time_slots),
    }


@router.patch("/my-availability")
def update_my_availability(
    body: AvailabilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.account_type != "restaurant":
        raise HTTPException(status_code=403, detail="Restaurant account required.")
    current_user.available_time_slots = ",".join(body.time_slots)
    current_user.booking_window_days = body.booking_window_days
    db.commit()
    db.refresh(current_user)
    return {"time_slots": body.time_slots, "booking_window_days": body.booking_window_days}
