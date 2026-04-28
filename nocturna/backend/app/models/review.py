from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean

from app.core.db import Base


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    venue_id = Column(Integer, ForeignKey("venues.id", ondelete="CASCADE"), nullable=True)
    plan_id = Column(Integer, ForeignKey("plans.id", ondelete="CASCADE"), nullable=True)

    rating = Column(Integer, nullable=False)  # 1..5 overall
    vibe_accuracy = Column(Integer, nullable=True)
    crowd_rating = Column(Integer, nullable=True)
    music_rating = Column(Integer, nullable=True)
    service_rating = Column(Integer, nullable=True)
    food_rating = Column(Integer, nullable=True)
    drinks_rating = Column(Integer, nullable=True)
    price_accuracy = Column(Integer, nullable=True)

    crowded_level = Column(String, nullable=True)  # empty|moderate|busy|packed
    would_return = Column(Boolean, default=True, nullable=False)
    comments = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
