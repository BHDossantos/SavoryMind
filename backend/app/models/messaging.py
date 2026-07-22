"""Outbound message log (P2 §7).

Every WhatsApp/SMS send is recorded here with its delivery status so the
owner can see what went out and support can debug. GDPR: we store the
recipient number + template, never the raw personal content beyond what's
needed to audit delivery.
"""
import datetime

from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey

from ..core.database import Base


class MessageLog(Base):
    __tablename__ = "message_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # owner/tenant
    channel = Column(String(20), nullable=False, default="whatsapp")  # whatsapp|sms
    provider = Column(String(20), nullable=True)     # meta|twilio|none
    to_number = Column(String(32), nullable=False)
    template = Column(String(60), nullable=False)    # staff_digest|owner_weekly|booking_alert
    status = Column(String(20), nullable=False, default="queued")  # queued|sent|failed|skipped
    provider_message_id = Column(String(120), nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
