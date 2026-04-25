from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.diner import DinerReview
from ...services import diner_service, discovery_service, discover_service
from ...ml.engine import build_diner_recommendations

router = APIRouter(prefix="/diner", tags=["diner"])


def require_diner(user: User = Depends(get_current_user)) -> User:
    if user.account_type != "diner":
        raise HTTPException(status_code=403, detail="Diner accounts only.")
    return user


# ── Bookings ──────────────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    restaurant_name: str = Field(min_length=1, max_length=150)
    booking_date: str = Field(min_length=8, max_length=20)
    booking_time: str = Field(default="19:00", max_length=10)
    party_size: int = Field(default=2, ge=1, le=20)
    special_requests: Optional[str] = Field(default="", max_length=500)


@router.get("/bookings")
def list_bookings(db: Session = Depends(get_db), user: User = Depends(require_diner)):
    return diner_service.get_bookings(db, user.id)


@router.post("/bookings", status_code=201)
def create_booking(body: BookingCreate, db: Session = Depends(get_db), user: User = Depends(require_diner)):
    return diner_service.create_booking(db, user.id, body.model_dump())


@router.patch("/bookings/{booking_id}/cancel", status_code=200)
def cancel_booking(booking_id: int, db: Session = Depends(get_db), user: User = Depends(require_diner)):
    if not diner_service.cancel_booking(db, user.id, booking_id):
        raise HTTPException(status_code=404, detail="Booking not found.")
    return {"status": "cancelled"}


# ── Visits ────────────────────────────────────────────────────────────────────

class VisitCreate(BaseModel):
    restaurant_name: str = Field(min_length=1, max_length=150)
    visit_date: Optional[str] = None
    items_ordered: Optional[str] = Field(default="", max_length=1000)
    overall_rating: float = Field(default=5.0, ge=1, le=5)
    food_rating: float = Field(default=5.0, ge=1, le=5)
    staff_rating: float = Field(default=5.0, ge=1, le=5)
    would_return: bool = True
    highlights: Optional[str] = Field(default="", max_length=500)
    lowlights: Optional[str] = Field(default="", max_length=500)
    notes: Optional[str] = Field(default="", max_length=1000)


@router.get("/visits")
def list_visits(db: Session = Depends(get_db), user: User = Depends(require_diner)):
    return diner_service.get_visits(db, user.id)


@router.post("/visits", status_code=201)
def create_visit(body: VisitCreate, db: Session = Depends(get_db), user: User = Depends(require_diner)):
    return diner_service.create_visit(db, user.id, body.model_dump())


@router.delete("/visits/{visit_id}", status_code=204)
def delete_visit(visit_id: int, db: Session = Depends(get_db), user: User = Depends(require_diner)):
    if not diner_service.delete_visit(db, user.id, visit_id):
        raise HTTPException(status_code=404, detail="Visit not found.")


@router.get("/summary")
def diner_summary(db: Session = Depends(get_db), user: User = Depends(require_diner)):
    return diner_service.get_diner_summary(db, user.id)


# ── Recommendations (ML engine) ───────────────────────────────────────────────

@router.get("/recommendations")
def diner_recommendations(db: Session = Depends(get_db), user: User = Depends(require_diner)):
    return build_diner_recommendations(db, user)


# ── Restaurant Discovery ───────────────────────────────────────────────────────

@router.get("/discover")
def discover(
    mood: str = "",
    cuisine: str = "",
    max_price_level: int = 4,
    max_wait_minutes: int = 60,
    open_now: bool = True,
    user: User = Depends(require_diner),
):
    return discovery_service.discover_restaurants(
        mood=mood,
        cuisine=cuisine,
        max_price_level=max_price_level,
        max_wait_minutes=max_wait_minutes,
        open_now=open_now,
    )


_MUSIC_MAP = {
    "romantic":    {"genre": "Jazz / Bossa Nova",     "vibe": "Soft, intimate, slow"},
    "adventurous": {"genre": "World Music / Afrobeat", "vibe": "Energetic, exploratory"},
    "relaxed":     {"genre": "Acoustic / Lo-fi",       "vibe": "Calm, unhurried"},
    "celebratory": {"genre": "Lounge / Deep House",    "vibe": "Upbeat, celebratory"},
    "group":       {"genre": "Pop / Hip-Hop",          "vibe": "Fun, social, singalong"},
    "cozy":        {"genre": "Jazz / Indie Folk",      "vibe": "Warm, comforting"},
    "healthy":     {"genre": "Acoustic / Ambient",     "vibe": "Fresh, mindful"},
}

_TITLES = {
    "romantic": "A night to remember 🥂", "adventurous": "Your next great food story 🌍",
    "celebratory": "Celebrate every bite 🎉", "relaxed": "No rush. Just good food. ✨",
    "group": "The whole crew. One perfect table. 👥", "cozy": "Pull up a chair. Stay a while. 🕯️",
    "healthy": "Feel good from the first bite 🌿",
}


@router.get("/experience-plan")
def experience_plan(
    mood: str = "",
    cuisine: str = "",
    budget: str = "mid",
    db: Session = Depends(get_db),
    user: User = Depends(require_diner),
):
    price_map = {"budget": 2, "mid": 3, "luxury": 4}
    max_price = price_map.get(budget, 3)
    restaurants = discover_service.get_restaurants(db, cuisine=cuisine, mood=mood, max_price_level=max_price)
    restaurant = restaurants[0] if restaurants else None
    music = _MUSIC_MAP.get(mood.lower(), {"genre": "Curated Mix", "vibe": "Perfect for your evening"})
    drink_map = {4: "🍷 Fine wine selection", 3: "🍷 House wine", 2: "🍺 Craft beer or house wine", 1: "🧃 Soft drink"}
    return {
        "restaurant": restaurant,
        "music": music,
        "drink": drink_map.get(min(max_price, 4), "🍷 House wine"),
        "mood": mood,
        "experience_title": _TITLES.get(mood.lower(), "Your perfect dining experience 🍽️"),
    }


# ── Reviews ───────────────────────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    restaurant_user_id: int
    booking_id: Optional[int] = None
    rating: float = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=1000)


@router.post("/reviews", status_code=201)
def create_review(body: ReviewCreate, db: Session = Depends(get_db), user: User = Depends(require_diner)):
    existing = db.query(DinerReview).filter(
        DinerReview.diner_user_id == user.id,
        DinerReview.restaurant_user_id == body.restaurant_user_id,
        DinerReview.booking_id == body.booking_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Review already submitted for this booking.")
    review = DinerReview(
        diner_user_id=user.id,
        restaurant_user_id=body.restaurant_user_id,
        booking_id=body.booking_id,
        rating=body.rating,
        comment=body.comment,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return {"id": review.id, "rating": review.rating, "comment": review.comment, "created_at": str(review.created_at)}


@router.get("/reviews")
def list_my_reviews(db: Session = Depends(get_db), user: User = Depends(require_diner)):
    reviews = db.query(DinerReview).filter(DinerReview.diner_user_id == user.id).all()
    return [{"id": r.id, "restaurant_user_id": r.restaurant_user_id, "booking_id": r.booking_id,
             "rating": r.rating, "comment": r.comment, "created_at": str(r.created_at)} for r in reviews]
