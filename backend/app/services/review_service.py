from sqlalchemy.orm import Session
from ..models.review import Review
from ..schemas.review import ReviewCreate, SentimentSummary
from .sentiment_service import analyze_sentiment


def get_all_reviews(db: Session) -> list[Review]:
    return db.query(Review).order_by(Review.created_at.desc()).all()


def create_review(db: Session, review: ReviewCreate) -> Review:
    score, label = analyze_sentiment(review.comment)
    db_review = Review(
        **review.model_dump(),
        sentiment_score=score,
        sentiment_label=label,
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    return db_review


def get_sentiment_summary(db: Session) -> SentimentSummary:
    reviews = get_all_reviews(db)
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
