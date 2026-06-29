import json
from collections import Counter
from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models.review import Review
from ..models.menu import MenuItem
from ..schemas.review import ReviewCreate, SentimentSummary
from .sentiment_service import analyze_sentiment, extract_themes


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

    # Best-effort theme extraction. Failure here doesn't block the save.
    themes = extract_themes(review.comment)

    db_review = Review(
        **review.model_dump(),
        user_id=user_id,
        sentiment_score=score,
        sentiment_label=label,
        # Themes columns are nullable — only populate when Claude returned data.
        themes=     json.dumps(themes["themes"])     if themes else None,
        complaints= json.dumps(themes["complaints"]) if themes else None,
        praise=     json.dumps(themes["praise"])     if themes else None,
        tone=       themes["tone"]                    if themes else None,
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


def _decode(value):
    """JSON-decode a stored review-themes column. Returns [] for null/garbage
    so callers can iterate without checking."""
    if not value:
        return []
    try:
        decoded = json.loads(value)
        return decoded if isinstance(decoded, list) else []
    except (TypeError, ValueError):
        return []


def get_themes_summary(db: Session, user_id: int) -> dict:
    """Aggregate the Claude-extracted themes/complaints/praise across all
    reviews for one restaurant. Powers the new themes panel in the
    sentiment dashboard.

    Returns counts of the most-mentioned themes / complaints / praise
    (top 8 each), plus a tone breakdown, plus the count of reviews that
    actually have theme data (vs. reviews from before Claude was wired
    or where the API call failed).
    """
    reviews = get_all_reviews(db, user_id)

    themes_counter:     Counter[str] = Counter()
    complaints_counter: Counter[str] = Counter()
    praise_counter:     Counter[str] = Counter()
    tone_counter:       Counter[str] = Counter()
    enriched = 0

    for r in reviews:
        if r.themes or r.complaints or r.praise or r.tone:
            enriched += 1
        themes_counter.update(_decode(r.themes))
        complaints_counter.update(_decode(r.complaints))
        praise_counter.update(_decode(r.praise))
        if r.tone:
            tone_counter[r.tone] += 1

    return {
        "total_reviews":      len(reviews),
        "enriched_reviews":   enriched,
        "top_themes":         [{"label": k, "count": v} for k, v in themes_counter.most_common(8)],
        "top_complaints":     [{"label": k, "count": v} for k, v in complaints_counter.most_common(8)],
        "top_praise":         [{"label": k, "count": v} for k, v in praise_counter.most_common(8)],
        "tone_breakdown":     dict(tone_counter),
    }
