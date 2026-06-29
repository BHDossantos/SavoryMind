"""Audit log helper. record() is fire-and-forget — never breaks the
caller's flow on a DB error. Logs go to audit_logs and can be reviewed
via /api/restaurant/audit-log (manager-only).
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from sqlalchemy.orm import Session

from ..models.audit_log import AuditLog

logger = logging.getLogger(__name__)


def record(
    db: Session,
    *,
    actor_user_id: Optional[int],
    tenant_user_id: Optional[int] = None,
    action: str,
    target: str = "",
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    try:
        row = AuditLog(
            actor_user_id=actor_user_id,
            tenant_user_id=tenant_user_id if tenant_user_id is not None else actor_user_id,
            action=action,
            target=target or None,
            extra_metadata=json.dumps(metadata, default=str) if metadata else None,
        )
        db.add(row); db.commit()
    except Exception:
        logger.exception("audit_log_service.record failed for action=%s", action)
        try:
            db.rollback()
        except Exception:
            pass


def list_for_tenant(db: Session, tenant_user_id: int, limit: int = 100) -> list[AuditLog]:
    return (
        db.query(AuditLog)
        .filter(AuditLog.tenant_user_id == tenant_user_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
