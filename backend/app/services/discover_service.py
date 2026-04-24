"""
Real restaurant discovery — queries registered restaurant accounts from the DB.
Replaces the old hardcoded mock data in discovery_service.py.
"""
from datetime import date as date_type
from sqlalchemy.orm import Session
from ..models.user import User
from ..models.restaurant_ext import Booking


DEFAULT_SLOTS = ["12:00", "12:30", "13:00", "19:00", "19:30", "20:00", "20:30", "21:00"]


def _slots_for(user: User) -> list[str]:
    if user.available_time_slots:
        return [s.strip() for s in user.available_time_slots.split(",") if s.strip()]
    return DEFAULT_SLOTS


def get_restaurants(
    db: Session,
    cuisine: str = "",
    city: str = "",
    mood: str = "",
    max_price_level: int = 4,
) -> list[dict]:
    """Return all onboarded restaurant accounts, optionally filtered."""
    q = db.query(User).filter(
        User.account_type == "restaurant",
        User.onboarding_completed == True,  # noqa: E712
    )
    if cuisine:
        q = q.filter(User.restaurant_cuisine.ilike(f"%{cuisine}%"))
    if city:
        q = q.filter(User.city.ilike(f"%{city}%"))

    restaurants = q.all()

    # Mood → dining_style mapping for soft filtering
    mood_map = {
        "romantic": ["fine_dining", "casual_fine", "bistro"],
        "casual": ["casual", "pub", "cafe", "fast_casual"],
        "celebratory": ["fine_dining", "casual_fine"],
        "business": ["fine_dining", "casual_fine", "bistro"],
        "family": ["casual", "pub", "cafe", "fast_casual"],
    }
    allowed_styles = mood_map.get(mood.lower(), []) if mood else []

    results = []
    for r in restaurants:
        # Soft mood filter — skip only if style is explicitly set and doesn't match
        if allowed_styles and r.dining_style and r.dining_style not in allowed_styles:
            continue
        results.append(_to_dict(r))

    return results


def get_restaurant(db: Session, restaurant_user_id: int) -> dict | None:
    r = db.query(User).filter(
        User.id == restaurant_user_id,
        User.account_type == "restaurant",
    ).first()
    return _to_dict(r) if r else None


def get_availability(db: Session, restaurant_user_id: int, check_date: date_type) -> dict:
    """Return available time slots for a restaurant on a given date."""
    restaurant = db.query(User).filter(User.id == restaurant_user_id).first()
    if not restaurant:
        return {"date": str(check_date), "slots": []}

    all_slots = _slots_for(restaurant)
    capacity = restaurant.seating_capacity or 40

    # Count confirmed/pending bookings per slot for that date
    existing: dict[str, int] = {}
    bookings = db.query(Booking).filter(
        Booking.user_id == restaurant_user_id,
        Booking.date == check_date,
        Booking.status.in_(["confirmed", "pending", "seated"]),
    ).all()
    for b in bookings:
        existing[b.time_slot] = existing.get(b.time_slot, 0) + b.party_size

    available = []
    for slot in all_slots:
        booked_covers = existing.get(slot, 0)
        remaining = capacity - booked_covers
        if remaining > 0:
            available.append({"time": slot, "remaining_covers": remaining})

    return {
        "restaurant_id": restaurant_user_id,
        "date": str(check_date),
        "slots": available,
    }


def _to_dict(r: User) -> dict:
    cuisines = []
    if r.restaurant_cuisine:
        cuisines = [c.strip() for c in r.restaurant_cuisine.split(",")]

    price_map = {"fast_casual": 1, "pub": 1, "cafe": 2, "casual": 2,
                 "bistro": 2, "casual_fine": 3, "fine_dining": 4}
    price_level = price_map.get(r.dining_style or "", 2)

    return {
        "id": r.id,
        "name": r.display_name,
        "cuisine": cuisines,
        "city": r.city or "",
        "country": r.country or "",
        "dining_style": r.dining_style or "casual",
        "target_audience": r.target_audience or "",
        "seating_capacity": r.seating_capacity or 0,
        "serves_wine": r.serves_wine or False,
        "serves_cocktails": r.serves_cocktails or False,
        "serves_beer": r.serves_beer or False,
        "price_level": price_level,
        "available_slots": _slots_for(r),
        "booking_window_days": r.booking_window_days or 60,
        "avatar_url": r.avatar_url or "",
        "bio": r.bio or "",
    }
