from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import get_current_user
from ...schemas.review import ReviewCreate, ReviewResponse, SentimentSummary
from ...services import review_service
from ...models.user import User

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/summary", response_model=SentimentSummary)
def sentiment_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return review_service.get_sentiment_summary(db, current_user.id)


@router.get("/", response_model=list[ReviewResponse])
def list_reviews(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return review_service.get_all_reviews(db, current_user.id)


@router.post("/", response_model=ReviewResponse, status_code=201)
def create_review(review: ReviewCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return review_service.create_review(db, current_user.id, review)


@router.delete("/{review_id}", status_code=204)
def delete_review(review_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not review_service.delete_review(db, current_user.id, review_id):
        raise HTTPException(status_code=404, detail="Review not found")
