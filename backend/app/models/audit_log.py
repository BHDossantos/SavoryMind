"""Audit log entry — every mutating action a user takes lands here.

Captured by audit_log_service.record() invoked from route handlers (we
add it as a one-liner where it matters; future versions can hook a
middleware). actor_user_id is the user who performed the action;
tenant_user_id is the restaurant the action was scoped to (often the
same; differs when a staff user acts on the employer's tenant).
"""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey

from ..core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id              = Column(Integer, primary_key=True, index=True)
    actor_user_id   = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    tenant_user_id  = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action          = Column(String(80), nullable=False)
    target          = Column(String(120), nullable=True)
    extra_metadata  = Column("metadata", Text, nullable=True)
    created_at      = Column(DateTime, nullable=False, default=datetime.utcnow)
