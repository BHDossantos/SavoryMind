from datetime import date
from sqlalchemy.orm import Session
from ..models.restaurant_ext import Booking
from ..models.diner import DinerBooking
from ..models.user import User
from ..schemas.restaurant_ext import BookingCreate, BookingUpdate
from . import notification_service, discover_service


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

    db.commit()
    db.refresh(diner_booking)
    return diner_booking


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
