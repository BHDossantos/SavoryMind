"""
Real restaurant discovery — queries registered restaurant accounts from the DB.

Everything a consumer sees in discover/profiles comes from here: real
restaurant rows, live rating aggregates from DinerReview, the public menu
(price + description only — cost is operator-private), and optional
"near me" distance search over the lat/lng the restaurant set on their
profile (pure-Python Haversine; no PostGIS dependency).
"""
import math
from datetime import date as date_type
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..models.user import User
from ..models.restaurant_ext import Booking
from ..models.diner import DinerReview
from ..models.menu import MenuItem


DEFAULT_SLOTS = ["12:00", "12:30", "13:00", "19:00", "19:30", "20:00", "20:30", "21:00"]


def _slots_for(user: User) -> list[str]:
    if user.available_time_slots:
        return [s.strip() for s in user.available_time_slots.split(",") if s.strip()]
    return DEFAULT_SLOTS


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _ratings_for(db: Session, restaurant_ids: list[int]) -> dict[int, tuple[float, int]]:
    """{restaurant_user_id: (avg_rating, review_count)} in one grouped query."""
    if not restaurant_ids:
        return {}
    rows = (
        db.query(
            DinerReview.restaurant_user_id,
            func.avg(DinerReview.rating),
            func.count(DinerReview.id),
        )
        .filter(DinerReview.restaurant_user_id.in_(restaurant_ids))
        .group_by(DinerReview.restaurant_user_id)
        .all()
    )
    return {rid: (round(float(avg), 1), int(cnt)) for rid, avg, cnt in rows}


def get_restaurants(
    db: Session,
    cuisine: str = "",
    city: str = "",
    mood: str = "",
    max_price_level: int = 4,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float | None = None,
) -> list[dict]:
    """Return all onboarded restaurant accounts, optionally filtered.

    When lat/lng are provided, each result carries distance_km (for
    restaurants that have coordinates) and the list is sorted nearest-first;
    radius_km additionally drops anything farther out. Restaurants without
    coordinates sort after located ones rather than disappearing — a missing
    pin shouldn't hide a bookable restaurant.
    """
    q = db.query(User).filter(
        User.account_type == "restaurant",
        User.onboarding_completed == True,  # noqa: E712
    )
    def _esc(s: str) -> str:
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    if cuisine:
        q = q.filter(User.restaurant_cuisine.ilike(f"%{_esc(cuisine)}%"))
    if city:
        q = q.filter(User.city.ilike(f"%{_esc(city)}%"))

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

    filtered = []
    for r in restaurants:
        # Soft mood filter — skip only if style is explicitly set and doesn't match
        if allowed_styles and r.dining_style and r.dining_style not in allowed_styles:
            continue
        filtered.append(r)

    ratings = _ratings_for(db, [r.id for r in filtered])

    geo = lat is not None and lng is not None
    results = []
    for r in filtered:
        d = _to_dict(r, ratings.get(r.id))
        if geo:
            if r.latitude is not None and r.longitude is not None:
                d["distance_km"] = round(haversine_km(lat, lng, r.latitude, r.longitude), 1)
            else:
                d["distance_km"] = None
            if radius_km is not None and (d["distance_km"] is None or d["distance_km"] > radius_km):
                continue
        results.append(d)

    if geo:
        results.sort(key=lambda d: (d["distance_km"] is None, d["distance_km"] or 0.0))
    return results


def get_restaurant(db: Session, restaurant_user_id: int) -> dict | None:
    r = db.query(User).filter(
        User.id == restaurant_user_id,
        User.account_type == "restaurant",
    ).first()
    if not r:
        return None
    ratings = _ratings_for(db, [r.id])
    return _to_dict(r, ratings.get(r.id))


def get_public_menu(db: Session, restaurant_user_id: int) -> list[dict]:
    """Consumer-facing menu: name/category/price/description/rating only.
    cost (the operator's margin data) never leaves the restaurant side."""
    items = (
        db.query(MenuItem)
        .filter(MenuItem.user_id == restaurant_user_id)
        .order_by(MenuItem.category, MenuItem.name)
        .all()
    )
    return [
        {
            "id": i.id,
            "name": i.name,
            "category": i.category,
            "price": i.price,
            "description": i.description or "",
            "rating": i.rating or 0.0,
        }
        for i in items
    ]


def get_public_reviews(db: Session, restaurant_user_id: int, limit: int = 20) -> dict:
    """Recent consumer reviews with first-name-only attribution."""
    rows = (
        db.query(DinerReview, User.first_name, User.display_name)
        .join(User, User.id == DinerReview.diner_user_id)
        .filter(DinerReview.restaurant_user_id == restaurant_user_id)
        .order_by(DinerReview.created_at.desc(), DinerReview.id.desc())
        .limit(limit)
        .all()
    )
    ratings = _ratings_for(db, [restaurant_user_id])
    avg, count = ratings.get(restaurant_user_id, (0.0, 0))
    return {
        "average_rating": avg,
        "review_count": count,
        "reviews": [
            {
                "rating": rv.rating,
                "comment": rv.comment or "",
                "date": str(rv.created_at) if rv.created_at else "",
                "diner_name": (first or (display or "").split(" ")[0] or "Guest"),
            }
            for rv, first, display in rows
        ],
    }


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


def _to_dict(r: User, rating: tuple[float, int] | None = None) -> dict:
    cuisines = []
    if r.restaurant_cuisine:
        cuisines = [c.strip() for c in r.restaurant_cuisine.split(",")]

    price_map = {"fast_casual": 1, "pub": 1, "cafe": 2, "casual": 2,
                 "bistro": 2, "casual_fine": 3, "fine_dining": 4}
    price_level = price_map.get(r.dining_style or "", 2)

    avg, count = rating if rating else (0.0, 0)
    return {
        "id": r.id,
        "name": r.display_name,
        "cuisine": cuisines,
        "city": r.city or "",
        "country": r.country or "",
        "street_address": r.street_address or "",
        "opening_hours": r.opening_hours or "",
        "latitude": r.latitude,
        "longitude": r.longitude,
        "slug": r.slug or "",
        "dining_style": r.dining_style or "casual",
        "target_audience": r.target_audience or "",
        "seating_capacity": r.seating_capacity or 0,
        "serves_wine": r.serves_wine or False,
        "serves_cocktails": r.serves_cocktails or False,
        "serves_beer": r.serves_beer or False,
        "price_level": price_level,
        "rating": avg,
        "review_count": count,
        "available_slots": _slots_for(r),
        "booking_window_days": r.booking_window_days or 60,
        "avatar_url": r.avatar_url or "",
        "bio": r.bio or "",
    }
