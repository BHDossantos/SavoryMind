from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from datetime import datetime
from ..core.database import Base


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    customer_name = Column(String, nullable=False)
    menu_item = Column(String, nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=False)
    # VADER-derived numeric polarity. Cheap, runs on every save, never null.
    sentiment_score = Column(Float, default=0.0)
    sentiment_label = Column(String, default="neutral")
    # Claude-derived structured themes. Best-effort: if the API call fails
    # at create time, these stay null and the review still saves with the
    # VADER data above. JSON-encoded lists / single strings stored as Text
    # so the column type is identical on SQLite and Postgres.
    themes        = Column(Text, nullable=True)  # JSON list of short tags
    complaints    = Column(Text, nullable=True)  # JSON list of specific gripes
    praise        = Column(Text, nullable=True)  # JSON list of specific positives
    tone          = Column(String, nullable=True)  # one of: positive | neutral | mixed | frustrated | angry
    created_at = Column(DateTime, default=datetime.utcnow)

    # Operator's public reply. Written via Flavor's respond_to_review
    # action tool (Phase 9c) or the sentiment screen. NULL = unanswered.
    response      = Column(Text, nullable=True)
    responded_at  = Column(DateTime, nullable=True)
