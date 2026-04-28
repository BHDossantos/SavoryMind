from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text

from app.core.db import Base


class Promo(Base):
    __tablename__ = "promos"

    id = Column(Integer, primary_key=True, index=True)
    venue_id = Column(Integer, ForeignKey("venues.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False)  # happy_hour|free_entry|ladies_night|dj|aperitivo|vip_special|live_event
    description = Column(Text, nullable=True)
    starts_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
