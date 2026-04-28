from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float

from app.core.db import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    plan_id = Column(Integer, ForeignKey("plans.id", ondelete="SET NULL"), nullable=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True)
    venue_id = Column(Integer, ForeignKey("venues.id", ondelete="SET NULL"), nullable=True)
    purpose = Column(String, nullable=False)
    # instant_plan|premium_date|vip_concierge|venue_commission|subscription
    amount_eur = Column(Float, nullable=False)
    currency = Column(String, default="EUR", nullable=False)
    stripe_session_id = Column(String, nullable=True, index=True)
    stripe_payment_intent_id = Column(String, nullable=True, index=True)
    status = Column(String, default="pending", nullable=False)
    # pending|succeeded|failed|refunded
    receipt_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
