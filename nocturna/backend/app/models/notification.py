from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON

from app.core.db import Base


class NotificationLog(Base):
    __tablename__ = "notifications_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True)
    plan_id = Column(Integer, ForeignKey("plans.id", ondelete="SET NULL"), nullable=True)
    channel = Column(String, nullable=False)  # email|sms|whatsapp|push
    recipient = Column(String, nullable=False)
    subject = Column(String, nullable=True)
    body = Column(Text, nullable=False)
    payload = Column(JSON, nullable=True)
    provider = Column(String, nullable=True)  # twilio|expo|sendgrid|console
    provider_message_id = Column(String, nullable=True)
    status = Column(String, default="queued", nullable=False)
    # queued|sent|delivered|failed
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
