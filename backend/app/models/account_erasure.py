from datetime import datetime
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from ..core.database import Base


class AccountErasureRun(Base):
    __tablename__ = 'account_erasure_runs'
    request_id = Column(String(36), ForeignKey('account_deletion_requests.id'), primary_key=True)
    plan_sha = Column(String(64), nullable=False)
    policy_ref = Column(String(200), nullable=False)
    state = Column(String(32), nullable=False, default='prepared')
    evidence = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    database_erased_at = Column(DateTime, nullable=True)


class AccountErasureReview(Base):
    """Append-only review history; re-preparing never replaces prior evidence."""
    __tablename__ = 'account_erasure_reviews'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column(String(36), ForeignKey('account_erasure_runs.request_id'), nullable=False, index=True)
    previous_plan_sha = Column(String(64), nullable=False)
    new_plan_sha = Column(String(64), nullable=False)
    previous_policy_ref = Column(String(200), nullable=False)
    new_policy_ref = Column(String(200), nullable=False)
    review_ref = Column(String(200), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
