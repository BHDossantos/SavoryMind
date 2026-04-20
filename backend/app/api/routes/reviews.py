from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...schemas.review import ReviewCreate, ReviewResponse, SentimentSummary
from ...services import review_service

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/summary", response_model=SentimentSummary)
def sentiment_summary(db: Session = Depends(get_db)):
    return review_service.get_sentiment_summary(db)


@router.get("/", response_model=list[ReviewResponse])
def list_reviews(db: Session = Depends(get_db)):
    return review_service.get_all_reviews(db)


@router.post("/", response_model=ReviewResponse, status_code=201)
def create_review(review: ReviewCreate, db: Session = Depends(get_db)):
    return review_service.create_review(db, review)
