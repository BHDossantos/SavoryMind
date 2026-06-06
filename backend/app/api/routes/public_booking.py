"""Public, no-auth booking endpoints — the surface behind savorymind.net/r/{slug}.

A restaurant shares their slug URL with their existing diners; the diner
hits the page, picks a slot, fills in name/phone, and books. No diner
account required. The booking lands in the restaurant's queue with all
the usual side-effects (in-app notification, email, SMS) and shows up on
their dashboard live via the polling channel.

Rate-limited at the endpoint level (slowapi) because there's no auth in
front of it; a spammer with the slug could otherwise drown a restaurant.
"""
from __future__ import annotations

from datetime import date as date_type
from datetime import timedelta
from html import escape

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...core.config import settings
from ...core.database import get_db
from ...core.rate_limit import limiter
from ...models.user import User
from ...models.restaurant_ext import Booking
from ...services import discover_service, notification_service, resend_client, twilio_client


router = APIRouter(prefix="/public/restaurants", tags=["public"])


# ── DTOs ──────────────────────────────────────────────────────────────────────

class PublicRestaurant(BaseModel):
    slug:            str
    display_name:    str
    restaurant_name: str | None = None
    business_type:   str | None = None
    dining_style:    str | None = None
    city:            str | None = None
    country:         str | None = None
    cuisines:        str | None = None  # raw JSON string — same shape as profile
    bio:             str | None = None


class AvailabilityDay(BaseModel):
    date:  str
    slots: list[dict]


class PublicRestaurantResponse(BaseModel):
    restaurant: PublicRestaurant
    upcoming:   list[AvailabilityDay]


class GuestBookingRequest(BaseModel):
    booking_date:     str
    booking_time:     str
    party_size:       int = Field(..., ge=1, le=20)
    customer_name:    str = Field(..., min_length=1, max_length=120)
    customer_phone:   str = Field(..., min_length=4,  max_length=32)
    customer_email:   str | None = None
    special_requests: str | None = None


class GuestBookingResponse(BaseModel):
    status:        str
    booking_id:    int
    confirmed_at:  str | None = None
    message:       str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/{slug}", response_model=PublicRestaurantResponse)
def get_public_restaurant(slug: str, db: Session = Depends(get_db)):
    """Fetch a restaurant by its public slug and the next 14 days of availability."""
    restaurant = db.query(User).filter(
        User.slug == slug,
        User.account_type == "restaurant",
        User.onboarding_completed == True,  # noqa: E712
    ).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    today = date_type.today()
    upcoming = []
    for offset in range(14):
        d = today + timedelta(days=offset)
        avail = discover_service.get_availability(db, restaurant.id, d)
        upcoming.append(AvailabilityDay(date=str(d), slots=avail["slots"]))

    return PublicRestaurantResponse(
        restaurant=PublicRestaurant(
            slug=restaurant.slug,
            display_name=restaurant.display_name,
            restaurant_name=restaurant.restaurant_name,
            business_type=restaurant.business_type,
            dining_style=restaurant.dining_style,
            city=restaurant.city,
            country=restaurant.country,
            cuisines=restaurant.restaurant_cuisine,
            bio=restaurant.bio,
        ),
        upcoming=upcoming,
    )


@router.post("/{slug}/book", response_model=GuestBookingResponse, status_code=201)
@limiter.limit("10/minute")
def book_as_guest(slug: str, body: GuestBookingRequest, request: Request, db: Session = Depends(get_db)):
    """Submit a booking against the restaurant slug — no account required.

    Mirrors the same availability check + status logic as the authenticated
    booking_service.request_booking, but writes only the restaurant-side
    Booking row (no DinerBooking, no diner user_id). The guest's phone is
    the contact channel. Rate-limited per IP because there's no auth gate.
    """
    restaurant = db.query(User).filter(
        User.slug == slug,
        User.account_type == "restaurant",
        User.onboarding_completed == True,  # noqa: E712
    ).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    try:
        booking_date = date_type.fromisoformat(body.booking_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid booking_date")

    # Same instant-confirm logic as the authenticated path
    availability = discover_service.get_availability(db, restaurant.id, booking_date)
    slot = next((s for s in availability["slots"] if s["time"] == body.booking_time), None)
    confirmed = slot is not None and slot["remaining_covers"] >= body.party_size
    status = "confirmed" if confirmed else "pending"

    booking = Booking(
        user_id=restaurant.id,
        customer_name=body.customer_name.strip(),
        customer_email=(body.customer_email or "").strip() or None,
        customer_phone=body.customer_phone.strip(),
        date=booking_date,
        time_slot=body.booking_time,
        party_size=body.party_size,
        notes=(body.special_requests or "").strip() or None,
        status=status,
        diner_user_id=None,
        source="public",
    )
    db.add(booking)

    # In-app notification on the restaurant dashboard (matches the
    # authenticated flow so the live-update polling picks it up).
    if confirmed:
        notification_service.create(
            db, restaurant.id,
            f"📅 New booking: {booking.customer_name}, party of {body.party_size}, "
            f"{booking_date} at {body.booking_time}.",
            link="/restaurant/bookings",
        )
    else:
        notification_service.create(
            db, restaurant.id,
            f"📩 Booking request: {booking.customer_name}, party of {body.party_size}, "
            f"{booking_date} at {body.booking_time} — needs confirmation.",
            link="/restaurant/bookings",
        )

    # Out-of-app alerts. Same code path as request_booking but inlined to
    # avoid pulling a DinerBooking parameter the helper expects.
    if restaurant.email:
        _send_guest_booking_email(
            restaurant.email,
            diner_name=booking.customer_name,
            party_size=body.party_size,
            booking_date=booking_date,
            booking_time=body.booking_time,
            special_requests=booking.notes or "",
            confirmed=confirmed,
        )
    if restaurant.phone:
        if confirmed:
            sms_body = (
                f"SavoryMind: new booking — {booking.customer_name}, "
                f"party of {body.party_size}, {booking_date} at {body.booking_time}."
            )
        else:
            sms_body = (
                f"SavoryMind: booking request — {booking.customer_name}, "
                f"party of {body.party_size}, {booking_date} at {body.booking_time}. "
                f"Needs your confirmation."
            )
        twilio_client.send_sms(restaurant.phone, sms_body)

    db.commit()
    db.refresh(booking)

    return GuestBookingResponse(
        status=status,
        booking_id=booking.id,
        confirmed_at=str(booking_date) if confirmed else None,
        message=(
            f"Confirmed for {booking_date} at {body.booking_time}."
            if confirmed
            else "Request received — the restaurant will confirm shortly."
        ),
    )


def _send_guest_booking_email(
    to: str,
    *,
    diner_name: str,
    party_size: int,
    booking_date: date_type,
    booking_time: str,
    special_requests: str,
    confirmed: bool,
) -> None:
    """Restaurant alert for a guest-link booking. Mirrors the authenticated
    booking email shape so the operator sees the same UI/format regardless
    of source."""
    safe_name    = escape(diner_name or "Guest")
    safe_date    = escape(str(booking_date))
    safe_time    = escape(booking_time or "")
    safe_party   = escape(str(party_size))
    safe_special = escape(special_requests or "")
    dashboard    = f"{settings.frontend_url.rstrip('/')}/restaurant/bookings"

    if confirmed:
        subject = f"New booking: {diner_name}, party of {party_size}"
        intro = "You have a new confirmed booking on SavoryMind:"
    else:
        subject = f"Booking request — {diner_name}, party of {party_size} (action needed)"
        intro = "A new booking request needs your confirmation:"

    requests_row = (
        f'<tr><td style="padding:8px 12px;color:#6b7280;"><strong>Special requests</strong></td>'
        f'<td style="padding:8px 12px;color:#111827;">{safe_special}</td></tr>'
        if safe_special else ""
    )
    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
      <h1 style="font-size:18px;margin:0 0 12px;">{escape(intro)}</h1>
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:12px;margin:16px 0;">
        <tr><td style="padding:8px 12px;color:#6b7280;"><strong>Guest</strong></td><td style="padding:8px 12px;color:#111827;">{safe_name}</td></tr>
        <tr><td style="padding:8px 12px;color:#6b7280;"><strong>Party</strong></td><td style="padding:8px 12px;color:#111827;">{safe_party}</td></tr>
        <tr><td style="padding:8px 12px;color:#6b7280;"><strong>Date</strong></td><td style="padding:8px 12px;color:#111827;">{safe_date}</td></tr>
        <tr><td style="padding:8px 12px;color:#6b7280;"><strong>Time</strong></td><td style="padding:8px 12px;color:#111827;">{safe_time}</td></tr>
        {requests_row}
      </table>
      <p style="margin:24px 0;">
        <a href="{dashboard}" style="background:#ea580c;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Open dashboard</a>
      </p>
      <p style="font-size:12px;color:#9ca3af;margin-top:32px;">
        Sent by SavoryMind. Manage your restaurant's bookings at <a href="{dashboard}" style="color:#9ca3af;">{dashboard}</a>.
      </p>
    </div>
    """.strip()
    resend_client.send_email(to, subject, html)
