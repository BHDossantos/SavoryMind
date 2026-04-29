from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user_optional
from app.models import Booking, PartnerProfile, Plan, User, Venue
from app.services import analytics, notifications
from app.services.rate_limit import BOOKING as BOOKING_LIMIT

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
    request: Request,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    if not user:
        ip = request.client.host if request.client else "unknown"
        if not BOOKING_LIMIT.take(ip):
            raise HTTPException(429, "Too many booking requests from this connection — please slow down.")
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
    analytics.capture(
        "booking_received", distinct_id=str(user.id) if user else booking.contact_email,
        properties={"venue_id": venue.id, "venue_name": venue.name,
                    "request_type": booking.request_type, "vip": booking.vip_interest == "yes",
                    "group_size": booking.group_size, "city": venue.city,
                    "plan_id": booking.plan_id},
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


# Multi-stop "Book this plan" ------------------------------------------------


class StopOverride(BaseModel):
    venue_id: int
    request_type: Optional[str] = None
    time: Optional[str] = None
    notes: Optional[str] = None
    skip: bool = False
    vip_interest: Optional[str] = None
    budget_eur: Optional[int] = None


class PlanBookingIn(BaseModel):
    contact_name: str
    contact_phone: str
    contact_email: EmailStr
    group_size: int = 2
    notes: Optional[str] = None
    bottle_preference: Optional[str] = None
    arrival_time: Optional[str] = None
    overrides: List[StopOverride] = Field(default_factory=list)


def _default_request_type(venue_type: str) -> str:
    return {
        "restaurant": "dinner",
        "late_food": "dinner",
        "bar": "bar_table",
        "lounge": "bar_table",
        "speakeasy": "bar_table",
        "rooftop": "bar_table",
        "live_music": "bar_table",
        "club": "guestlist",
    }.get(venue_type, "dinner")


@router.post("/plan/{plan_id}")
def book_plan(
    plan_id: int,
    payload: PlanBookingIn,
    request: Request,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    """Create a booking request for every stop in a plan in one shot.

    Skips stops the caller marked `skip=true`. Returns the list of created
    bookings plus the plan id; same notification fan-out as single bookings.
    """
    if not user:
        ip = request.client.host if request.client else "unknown"
        if not BOOKING_LIMIT.take(ip, n=2.0):
            raise HTTPException(429, "Too many booking requests from this connection — please slow down.")
    plan = db.query(Plan).get(plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    if not plan.generated:
        raise HTTPException(400, "Plan has no stops")

    overrides_by_venue: dict[int, StopOverride] = {
        o.venue_id: o for o in payload.overrides
    }

    created: List[dict] = []
    for stop in plan.generated:
        venue_id = stop.get("venue_id")
        venue = db.query(Venue).get(venue_id) if venue_id else None
        if not venue:
            continue
        ov = overrides_by_venue.get(venue.id)
        if ov and ov.skip:
            continue

        # Slot start "2026-05-02T21:00:00" -> ("2026-05-02", "21:00")
        slot_start = stop.get("slot_start") or ""
        if "T" in slot_start:
            date_str, time_str = slot_start.split("T", 1)
            time_str = time_str[:5]
        else:
            date_str = (plan.requested_for.isoformat() if plan.requested_for else "").split("T", 1)[0]
            time_str = "21:00"

        booking = Booking(
            user_id=user.id if user else None,
            venue_id=venue.id,
            plan_id=plan.id,
            contact_name=payload.contact_name,
            contact_phone=payload.contact_phone,
            contact_email=payload.contact_email,
            date=date_str,
            time=(ov.time if ov and ov.time else time_str),
            group_size=payload.group_size,
            request_type=(ov.request_type if ov and ov.request_type else _default_request_type(venue.type)),
            budget_eur=ov.budget_eur if ov else None,
            bottle_preference=payload.bottle_preference,
            arrival_time=payload.arrival_time,
            notes=(ov.notes if ov and ov.notes else payload.notes),
            vip_interest=(ov.vip_interest if ov and ov.vip_interest else "no"),
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
        notifications.notify_booking_received(
            db,
            booking,
            venue,
            user_email=payload.contact_email,
            user_phone=payload.contact_phone,
            whatsapp=(venue.contact or {}).get("whatsapp"),
            expo_token=push_token,
        )
        created.append(_booking_dict(booking, venue))

    if not created:
        raise HTTPException(400, "No bookable stops in this plan")

    plan.status = "booked"
    db.commit()
    analytics.capture(
        "plan_booked", distinct_id=str(user.id) if user else payload.contact_email,
        properties={"plan_id": plan.id, "stops_booked": len(created),
                    "city": plan.city, "intent": plan.intent,
                    "any_vip": any((o.vip_interest == "yes") for o in payload.overrides)},
    )
    return {"plan_id": plan.id, "bookings": created}


@router.get("/plan/{plan_id}")
def list_plan_bookings(
    plan_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    """All bookings created for a given plan (for the status-board view)."""
    plan = db.query(Plan).get(plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")

    rows = (
        db.query(Booking)
        .filter(Booking.plan_id == plan_id)
        .order_by(Booking.id.asc())
        .all()
    )
    if rows and plan.user_id and (not user or (user.id != plan.user_id and user.role != "admin")):
        # owner-only view — guests can only see their own
        if rows[0].user_id is not None and (not user or rows[0].user_id != user.id):
            raise HTTPException(403, "Forbidden")

    statuses = {b.status for b in rows}
    if not rows:
        agg = "none"
    elif statuses == {"confirmed"}:
        agg = "confirmed"
    elif "rejected" in statuses or "cancelled" in statuses:
        agg = "partial"
    elif "confirmed" in statuses:
        agg = "partial"
    else:
        agg = "pending"

    return {
        "plan_id": plan_id,
        "aggregate_status": agg,
        "bookings": [_booking_dict(b, db.query(Venue).get(b.venue_id)) for b in rows],
    }


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
