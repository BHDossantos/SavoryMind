from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.review import Review
from ...models.user import User
from ...schemas.review import ReviewCreate, ReviewResponse, SentimentSummary
from ...services import review_service, posthog_client, review_response_service

router = APIRouter(prefix="/reviews", tags=["reviews"])


def _require_restaurant(user: User) -> User:
    if user.account_type != "restaurant":
        raise HTTPException(status_code=403, detail="Restaurant account required.")
    return user


@router.get("/summary", response_model=SentimentSummary)
def sentiment_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return review_service.get_sentiment_summary(db, current_user.id)


@router.get("/themes")
def themes_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Aggregated theme / complaint / praise counts derived from each
    review's Claude-extracted structured data. top_* lists are empty
    when no reviews have been enriched yet (either Claude isn't
    configured or every review predates enrichment)."""
    _require_restaurant(current_user)
    return review_service.get_themes_summary(db, current_user.id)


@router.get("/", response_model=list[ReviewResponse])
def list_reviews(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return review_service.get_all_reviews(db, current_user.id)


@router.post("/", response_model=ReviewResponse, status_code=201)
def create_review(review: ReviewCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    created = review_service.create_review(db, current_user.id, review)
    # Engagement signal — most-impactful event for restaurant accounts.
    # Properties safe: rating bucket only, never the review text.
    posthog_client.capture(current_user.id, "review_submitted", {
        "rating":        getattr(created, "rating", None),
        "has_comment":   bool(getattr(created, "comment", None)),
    })
    return created


@router.delete("/{review_id}", status_code=204)
def delete_review(review_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    if not review_service.delete_review(db, current_user.id, review_id):
        raise HTTPException(status_code=404, detail="Review not found")


class ResponseSaveRequest(BaseModel):
    response: str


@router.post("/{review_id}/draft-response")
def draft_response(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a draft reply to a single review. The operator reviews and
    explicitly saves it via PATCH /reviews/{id}/response — nothing is
    auto-published."""
    _require_restaurant(current_user)
    r = db.query(Review).filter(
        Review.id == review_id, Review.user_id == current_user.id,
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Review not found")
    return review_response_service.generate(
        rating=int(r.rating or 0),
        comment=r.comment or "",
        guest_name=r.customer_name or "",
        restaurant_name=current_user.restaurant_name or current_user.display_name or "the restaurant",
        language=current_user.language or "en",
    )


@router.patch("/{review_id}/response")
def save_response(
    review_id: int,
    body: ResponseSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    r = db.query(Review).filter(
        Review.id == review_id, Review.user_id == current_user.id,
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Review not found")
    r.response = (body.response or "").strip() or None
    r.responded_at = datetime.utcnow() if r.response else None
    db.commit(); db.refresh(r)
    return {"id": r.id, "response": r.response, "responded_at": r.responded_at}
