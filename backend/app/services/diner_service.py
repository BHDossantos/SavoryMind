import datetime
from sqlalchemy.orm import Session
from ..models.diner import DinerBooking, DinerVisit


# ── Bookings ──────────────────────────────────────────────────────────────────

def get_bookings(db: Session, user_id: int):
    return db.query(DinerBooking).filter(DinerBooking.user_id == user_id).order_by(DinerBooking.booking_date.desc()).all()


def create_booking(db: Session, user_id: int, data: dict) -> DinerBooking:
    booking = DinerBooking(
        user_id=user_id,
        restaurant_name=data["restaurant_name"],
        booking_date=data["booking_date"],
        booking_time=data.get("booking_time", "19:00"),
        party_size=data.get("party_size", 2),
        special_requests=data.get("special_requests", ""),
        status="confirmed",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def cancel_booking(db: Session, user_id: int, booking_id: int) -> bool:
    b = db.query(DinerBooking).filter(DinerBooking.id == booking_id, DinerBooking.user_id == user_id).first()
    if not b:
        return False
    b.status = "cancelled"
    db.commit()
    return True


# ── Visits ────────────────────────────────────────────────────────────────────

def get_visits(db: Session, user_id: int):
    return db.query(DinerVisit).filter(DinerVisit.user_id == user_id).order_by(DinerVisit.visit_date.desc()).all()


def create_visit(db: Session, user_id: int, data: dict) -> DinerVisit:
    visit = DinerVisit(
        user_id=user_id,
        restaurant_name=data["restaurant_name"],
        visit_date=data.get("visit_date") or str(datetime.date.today()),
        items_ordered=data.get("items_ordered", ""),
        overall_rating=data.get("overall_rating", 5.0),
        food_rating=data.get("food_rating", 5.0),
        staff_rating=data.get("staff_rating", 5.0),
        would_return=data.get("would_return", True),
        highlights=data.get("highlights", ""),
        lowlights=data.get("lowlights", ""),
        notes=data.get("notes", ""),
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return visit


def delete_visit(db: Session, user_id: int, visit_id: int) -> bool:
    v = db.query(DinerVisit).filter(DinerVisit.id == visit_id, DinerVisit.user_id == user_id).first()
    if not v:
        return False
    db.delete(v)
    db.commit()
    return True


def get_diner_summary(db: Session, user_id: int) -> dict:
    visits = db.query(DinerVisit).filter(DinerVisit.user_id == user_id).all()
    bookings = db.query(DinerBooking).filter(DinerBooking.user_id == user_id).all()

    if not visits:
        return {
            "total_visits": 0,
            "total_bookings": len(bookings),
            "avg_overall": 0,
            "avg_food": 0,
            "avg_staff": 0,
            "return_rate": 0,
            "top_restaurants": [],
            "recent_visits": [],
        }

    avg_overall = sum(v.overall_rating for v in visits) / len(visits)
    avg_food = sum(v.food_rating for v in visits) / len(visits)
    avg_staff = sum(v.staff_rating for v in visits) / len(visits)
    return_rate = sum(1 for v in visits if v.would_return) / len(visits) * 100

    restaurant_counts: dict[str, int] = {}
    for v in visits:
        restaurant_counts[v.restaurant_name] = restaurant_counts.get(v.restaurant_name, 0) + 1

    top_restaurants = sorted(
        [{"name": k, "visits": v} for k, v in restaurant_counts.items()],
        key=lambda x: x["visits"], reverse=True,
    )[:5]

    return {
        "total_visits": len(visits),
        "total_bookings": len(bookings),
        "avg_overall": round(avg_overall, 1),
        "avg_food": round(avg_food, 1),
        "avg_staff": round(avg_staff, 1),
        "return_rate": round(return_rate, 1),
        "top_restaurants": top_restaurants,
    }
