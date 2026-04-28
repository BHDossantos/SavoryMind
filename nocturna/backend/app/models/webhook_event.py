from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON

from app.core.db import Base


class WebhookEvent(Base):
    """Idempotency record for Stripe webhook events.

    Stripe may deliver the same event multiple times; we store every event ID
    we've successfully processed so retries are no-ops.
    """
    __tablename__ = "webhook_events"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String, default="stripe", nullable=False, index=True)
    event_id = Column(String, unique=True, nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)
    payload = Column(JSON, nullable=True)
    processed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
