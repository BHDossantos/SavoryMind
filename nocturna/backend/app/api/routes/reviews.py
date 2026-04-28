from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user_optional
from app.models import Plan, Review, User, Venue

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


class ReviewIn(BaseModel):
    venue_id: Optional[int] = None
    plan_id: Optional[int] = None
    rating: int
    vibe_accuracy: Optional[int] = None
    crowd_rating: Optional[int] = None
    music_rating: Optional[int] = None
    service_rating: Optional[int] = None
    food_rating: Optional[int] = None
    drinks_rating: Optional[int] = None
    price_accuracy: Optional[int] = None
    crowded_level: Optional[str] = None
    would_return: bool = True
    comments: Optional[str] = None


@router.post("")
def create_review(
    payload: ReviewIn,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    if not payload.venue_id and not payload.plan_id:
        raise HTTPException(400, "Provide venue_id or plan_id")
    if payload.venue_id and not db.query(Venue).get(payload.venue_id):
        raise HTTPException(404, "Venue not found")
    if payload.plan_id and not db.query(Plan).get(payload.plan_id):
        raise HTTPException(404, "Plan not found")
    r = Review(
        user_id=user.id if user else None,
        **payload.model_dump(),
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return {"id": r.id, "ok": True}


@router.get("/venue/{venue_id}")
def venue_reviews(venue_id: int, db: Session = Depends(get_db)):
    rows = db.query(Review).filter(Review.venue_id == venue_id).order_by(Review.id.desc()).limit(50).all()
    avg = None
    if rows:
        avg = round(sum((r.rating or 0) for r in rows) / len(rows), 2)
    return {
        "average": avg,
        "count": len(rows),
        "items": [
            {
                "id": r.id,
                "rating": r.rating,
                "vibe_accuracy": r.vibe_accuracy,
                "crowd_rating": r.crowd_rating,
                "music_rating": r.music_rating,
                "service_rating": r.service_rating,
                "food_rating": r.food_rating,
                "drinks_rating": r.drinks_rating,
                "price_accuracy": r.price_accuracy,
                "crowded_level": r.crowded_level,
                "would_return": r.would_return,
                "comments": r.comments,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }
