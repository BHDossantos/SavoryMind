"""Durable deletion intake; completion is a separately verified operator action."""
import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from ..core.database import Base


class AccountDeletionRequest(Base):
    __tablename__ = 'account_deletion_requests'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, nullable=True, index=True)  # retained until erasure evidence is recorded
    # One open request per normalized address. Cleared on verified completion.
    email = Column(String(254), nullable=True, unique=True)
    reason = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default='awaiting_verification')
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    verified_at = Column(DateTime, nullable=True)
    verification_hash = Column(String(64), nullable=True, unique=True)
    verification_expires_at = Column(DateTime, nullable=True)
    notification_sent_at = Column(DateTime, nullable=True)
    # The queue never treats sending mail as proof of data erasure.
    completed_at = Column(DateTime, nullable=True)
    completion_evidence = Column(Text, nullable=True)
    retention_summary = Column(Text, nullable=True)
