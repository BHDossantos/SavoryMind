from datetime import date
from html import escape
from sqlalchemy.orm import Session
from ..core.config import settings
from ..models.restaurant_ext import Booking
from ..models.diner import DinerBooking
from ..models.user import User
from ..schemas.restaurant_ext import BookingCreate, BookingUpdate
from . import notification_service, discover_service, resend_client, twilio_client


def get_bookings(db: Session, user_id: int, filter_date: date | None = None) -> list[Booking]:
    q = db.query(Booking).filter(Booking.user_id == user_id)
    if filter_date:
        q = q.filter(Booking.date == filter_date)
    return q.order_by(Booking.date, Booking.time_slot).all()


def get_booking(db: Session, user_id: int, booking_id: int) -> Booking | None:
    return db.query(Booking).filter(Booking.id == booking_id, Booking.user_id == user_id).first()


def create_booking(db: Session, user_id: int, data: BookingCreate) -> Booking:
    booking = Booking(**data.model_dump(), user_id=user_id)
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def update_booking(db: Session, user_id: int, booking_id: int, data: BookingUpdate) -> Booking | None:
    booking = get_booking(db, user_id, booking_id)
    if not booking:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(booking, field, value)
    db.commit()
    db.refresh(booking)
    return booking


def delete_booking(db: Session, user_id: int, booking_id: int) -> bool:
    booking = get_booking(db, user_id, booking_id)
    if not booking:
        return False
    db.delete(booking)
    db.commit()
    return True


def request_booking(
    db: Session,
    diner_user_id: int,
    restaurant_user_id: int,
    booking_date: date,
    booking_time: str,
    party_size: int,
    special_requests: str = "",
) -> DinerBooking:
    """
    Diner books a table at a registered restaurant.

    Confirms instantly when the requested slot still has room for the party;
    otherwise the booking is created as `pending` for the restaurant to review
    (e.g. the slot filled up between page load and submit). Either way the
    reservation is mirrored into the restaurant's Booking queue and the
    restaurant is notified.
    """
    restaurant = db.query(User).filter(User.id == restaurant_user_id).first()
    diner = db.query(User).filter(User.id == diner_user_id).first()
    diner_name = diner.display_name if diner else "Online Guest"
    rest_name = restaurant.display_name if restaurant else "Restaurant"

    # Instant-confirm when the chosen slot still fits the party.
    availability = discover_service.get_availability(db, restaurant_user_id, booking_date)
    slot = next((s for s in availability["slots"] if s["time"] == booking_time), None)
    confirmed = slot is not None and slot["remaining_covers"] >= party_size
    status = "confirmed" if confirmed else "pending"

    # Restaurant-side booking, mirrored into their queue.
    rest_booking = Booking(
        user_id=restaurant_user_id,
        customer_name=diner_name,
        customer_email=diner.email if diner else None,
        date=booking_date,
        time_slot=booking_time,
        party_size=party_size,
        notes=special_requests or None,
        status=status,
        diner_user_id=diner_user_id,
        source="online",
    )
    db.add(rest_booking)
    db.flush()  # get rest_booking.id before committing

    # Diner-side booking, linked to the restaurant.
    diner_booking = DinerBooking(
        user_id=diner_user_id,
        restaurant_name=rest_name,
        booking_date=str(booking_date),
        booking_time=booking_time,
        party_size=party_size,
        special_requests=special_requests or "",
        status=status,
        restaurant_user_id=restaurant_user_id,
        restaurant_booking_id=rest_booking.id,
    )
    db.add(diner_booking)

    if confirmed:
        notification_service.create(
            db, restaurant_user_id,
            f"📅 New booking: {diner_name}, party of {party_size}, "
            f"{booking_date} at {booking_time}.",
            link="/restaurant/bookings",
        )
    else:
        notification_service.create(
            db, restaurant_user_id,
            f"📩 Booking request: {diner_name}, party of {party_size}, "
            f"{booking_date} at {booking_time} — needs confirmation.",
            link="/restaurant/bookings",
        )

    # Out-of-app alerts. The chime + toast on the restaurant dashboard only
    # fires if they're already in the app — these channels cover the case
    # where they aren't. Both no-op when their provider isn't configured.
    if restaurant and restaurant.email:
        _send_new_booking_email(
            restaurant.email,
            diner_name=diner_name,
            party_size=party_size,
            booking_date=booking_date,
            booking_time=booking_time,
            special_requests=special_requests,
            confirmed=confirmed,
        )
    if restaurant and restaurant.phone:
        _send_new_booking_sms(
            restaurant.phone,
            diner_name=diner_name,
            party_size=party_size,
            booking_date=booking_date,
            booking_time=booking_time,
            confirmed=confirmed,
        )

    db.commit()
    db.refresh(diner_booking)
    return diner_booking


def _send_new_booking_email(
    to: str,
    *,
    diner_name: str,
    party_size: int,
    booking_date: date,
    booking_time: str,
    special_requests: str,
    confirmed: bool,
) -> None:
    """Notify the restaurant by email that a new booking just landed.

    HTML is built with `html.escape()` on every user-supplied field — the
    diner name and special requests come straight from form input, so
    inlining them raw would be an injection vector.
    """
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


def _send_new_booking_sms(
    to: str,
    *,
    diner_name: str,
    party_size: int,
    booking_date: date,
    booking_time: str,
    confirmed: bool,
) -> None:
    """Notify the restaurant by SMS that a new booking just landed.

    Plain text only — the SMS is meant to be glanceable on a lock screen.
    Full details are in the email and the in-app dashboard.
    """
    if confirmed:
        body = (
            f"SavoryMind: new booking — {diner_name}, party of {party_size}, "
            f"{booking_date} at {booking_time}."
        )
    else:
        body = (
            f"SavoryMind: booking request — {diner_name}, party of {party_size}, "
            f"{booking_date} at {booking_time}. Needs your confirmation."
        )
    twilio_client.send_sms(to, body)


def confirm_booking(db: Session, restaurant_user_id: int, booking_id: int) -> Booking | None:
    """Restaurant confirms an online booking — updates both sides."""
    b = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.user_id == restaurant_user_id,
        Booking.source == "online",
    ).first()
    if not b:
        return None
    b.status = "confirmed"
    restaurant = db.query(User).filter(User.id == restaurant_user_id).first()
    rest_name = restaurant.display_name if restaurant else "the restaurant"
    if b.diner_user_id:
        db.query(DinerBooking).filter(
            DinerBooking.restaurant_booking_id == booking_id,
            DinerBooking.user_id == b.diner_user_id,
        ).update({"status": "confirmed"})
        notification_service.create(
            db, b.diner_user_id,
            f"✅ Your booking at {rest_name} on {b.date} at {b.time_slot} is confirmed!",
            link="/diner/book",
        )
    db.commit()
    db.refresh(b)
    return b


def decline_booking(db: Session, restaurant_user_id: int, booking_id: int) -> Booking | None:
    """Restaurant declines an online booking — updates both sides."""
    b = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.user_id == restaurant_user_id,
        Booking.source == "online",
    ).first()
    if not b:
        return None
    b.status = "declined"
    restaurant = db.query(User).filter(User.id == restaurant_user_id).first()
    rest_name = restaurant.display_name if restaurant else "the restaurant"
    if b.diner_user_id:
        db.query(DinerBooking).filter(
            DinerBooking.restaurant_booking_id == booking_id,
            DinerBooking.user_id == b.diner_user_id,
        ).update({"status": "declined"})
        notification_service.create(
            db, b.diner_user_id,
            f"❌ Your booking request at {rest_name} on {b.date} was not available. Try another date!",
            link="/diner/discover",
        )
    db.commit()
    db.refresh(b)
    return b


def get_today_summary(db: Session, user_id: int) -> dict:
    today = date.today()
    bookings = get_bookings(db, user_id, filter_date=today)
    confirmed = [b for b in bookings if b.status in ("confirmed", "seated")]
    total_covers = sum(b.party_size for b in confirmed)
    return {
        "total_bookings": len(bookings),
        "confirmed": len(confirmed),
        "cancelled": sum(1 for b in bookings if b.status == "cancelled"),
        "total_covers": total_covers,
        "upcoming": [
            {"time": b.time_slot, "name": b.customer_name, "party": b.party_size}
            for b in confirmed
        ],
    }
