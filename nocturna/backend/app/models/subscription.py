from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean

from app.core.db import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tier = Column(String, default="free", nullable=False)
    # free|premium_user|venue_basic|venue_pro|venue_premium
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True, index=True)
    status = Column(String, default="active", nullable=False)
    # active|trialing|past_due|cancelled|incomplete
    current_period_end = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
