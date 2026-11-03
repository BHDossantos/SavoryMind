from datetime import datetime
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
