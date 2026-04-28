from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user_optional
from app.models import Booking, PartnerProfile, User, Venue
from app.services import notifications

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


class BookingIn(BaseModel):
    venue_id: int
    plan_id: Optional[int] = None
    contact_name: str
    contact_phone: str
    contact_email: EmailStr
    date: str
    time: str
    group_size: int = 2
    request_type: str = "dinner"
    budget_eur: Optional[int] = None
    bottle_preference: Optional[str] = None
    arrival_time: Optional[str] = None
    notes: Optional[str] = None
    vip_interest: str = "no"


@router.post("")
def create_booking(
    payload: BookingIn,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    venue = db.query(Venue).get(payload.venue_id)
    if not venue:
        raise HTTPException(404, "Venue not found")
    booking = Booking(
        user_id=user.id if user else None,
        venue_id=payload.venue_id,
        plan_id=payload.plan_id,
        contact_name=payload.contact_name,
        contact_phone=payload.contact_phone,
        contact_email=payload.contact_email,
        date=payload.date,
        time=payload.time,
        group_size=payload.group_size,
        request_type=payload.request_type,
        budget_eur=payload.budget_eur,
        bottle_preference=payload.bottle_preference,
        arrival_time=payload.arrival_time,
        notes=payload.notes,
        vip_interest=payload.vip_interest,
        status="new",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    push_token = None
    if user:
        partner = db.query(PartnerProfile).filter(PartnerProfile.user_id == user.id).first()
        if partner:
            push_token = partner.push_token

    venue_whatsapp = (venue.contact or {}).get("whatsapp")
    notifications.notify_booking_received(
        db,
        booking,
        venue,
        user_email=payload.contact_email,
        user_phone=payload.contact_phone,
        whatsapp=venue_whatsapp,
        expo_token=push_token,
    )
    return _booking_dict(booking, venue)


@router.get("/{booking_id}")
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    b = db.query(Booking).get(booking_id)
    if not b:
        raise HTTPException(404, "Booking not found")
    if b.user_id is not None and (not user or (user.id != b.user_id and user.role != "admin")):
        raise HTTPException(403, "Forbidden")
    venue = db.query(Venue).get(b.venue_id)
    return _booking_dict(b, venue)


@router.get("/me/list")
def my_bookings(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    if not user:
        return []
    rows = db.query(Booking).filter(Booking.user_id == user.id).order_by(Booking.created_at.desc()).all()
    return [_booking_dict(b, db.query(Venue).get(b.venue_id)) for b in rows]


def _booking_dict(b: Booking, venue: Optional[Venue]) -> dict:
    return {
        "id": b.id,
        "status": b.status,
        "venue_id": b.venue_id,
        "venue": {
            "id": venue.id,
            "name": venue.name,
            "slug": venue.slug,
            "address": venue.address,
            "neighborhood": venue.neighborhood,
            "contact": venue.contact,
            "dress_code": venue.dress_code,
        } if venue else None,
        "plan_id": b.plan_id,
        "contact_name": b.contact_name,
        "contact_phone": b.contact_phone,
        "contact_email": b.contact_email,
        "date": b.date,
        "time": b.time,
        "group_size": b.group_size,
        "request_type": b.request_type,
        "budget_eur": b.budget_eur,
        "bottle_preference": b.bottle_preference,
        "arrival_time": b.arrival_time,
        "notes": b.notes,
        "vip_interest": b.vip_interest,
        "venue_response": b.venue_response,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }
