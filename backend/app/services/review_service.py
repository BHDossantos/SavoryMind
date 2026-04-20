from fastapi import HTTPException
from sqlalchemy.orm import Session
from ..models.review import Review
from ..models.menu import MenuItem
from ..schemas.review import ReviewCreate, SentimentSummary
from .sentiment_service import analyze_sentiment


def get_all_reviews(db: Session, user_id: int) -> list[Review]:
    return db.query(Review).filter(Review.user_id == user_id).order_by(Review.created_at.desc()).all()


def create_review(db: Session, user_id: int, review: ReviewCreate) -> Review:
    exists = db.query(MenuItem).filter(MenuItem.name == review.menu_item, MenuItem.user_id == user_id).first()
    if not exists:
        raise HTTPException(
            status_code=422,
            detail=f"No menu item named '{review.menu_item}' exists.",
        )
    score, label = analyze_sentiment(review.comment)
    db_review = Review(
        **review.model_dump(),
        user_id=user_id,
        sentiment_score=score,
        sentiment_label=label,
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    return db_review


def delete_review(db: Session, user_id: int, review_id: int) -> bool:
    review = db.query(Review).filter(Review.id == review_id, Review.user_id == user_id).first()
    if not review:
        return False
    db.delete(review)
    db.commit()
    return True


def get_sentiment_summary(db: Session, user_id: int) -> SentimentSummary:
    reviews = get_all_reviews(db, user_id)
    if not reviews:
        return SentimentSummary(
            total_reviews=0, avg_sentiment=0,
            positive_count=0, neutral_count=0, negative_count=0, avg_rating=0
        )

    avg_sentiment = sum(r.sentiment_score for r in reviews) / len(reviews)
    avg_rating = sum(r.rating for r in reviews) / len(reviews)
    positive = sum(1 for r in reviews if r.sentiment_label == "positive")
    neutral = sum(1 for r in reviews if r.sentiment_label == "neutral")
    negative = sum(1 for r in reviews if r.sentiment_label == "negative")

    return SentimentSummary(
        total_reviews=len(reviews),
        avg_sentiment=round(avg_sentiment, 3),
        positive_count=positive,
        neutral_count=neutral,
        negative_count=negative,
        avg_rating=round(avg_rating, 2),
    )
