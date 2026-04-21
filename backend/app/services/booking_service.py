from datetime import date
from sqlalchemy.orm import Session
from ..models.restaurant_ext import Booking
from ..schemas.restaurant_ext import BookingCreate, BookingUpdate


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
