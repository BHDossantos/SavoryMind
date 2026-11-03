"""Operator queue transitions. This module never guesses a retention policy.

Erasure must be performed under a reviewed plan. Recording completion requires
an absent account and explicit database/provider/backup/retention evidence.
"""
import json
import base64
from datetime import datetime
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import Session
from ..core.database import Base
from ..models.user import User
from ..models.account_deletion import AccountDeletionRequest


def inventory(db: Session, row: AccountDeletionRequest) -> dict:
    from .account_erasure import load_models
    load_models()
    counts = {}
    if row.user_id is not None:
        for table in Base.metadata.sorted_tables:
            for column in table.columns:
                direct = any(fk.target_fullname == 'users.id' for fk in column.foreign_keys)
                legacy = not column.foreign_keys and column.name in ('user_id', 'staff_user_id', 'employee_user_id', 'actor_user_id', 'tenant_user_id')
                if direct or legacy:
                    query = select(func.count()).select_from(table).where(column == row.user_id)
                    if table.name == 'account_deletion_requests':
                        query = query.where(table.c.id != row.id)
                    count = db.scalar(query)
                    if count:
                        counts[f'{table.name}.{column.name}'] = count
        counts['users.id'] = int(db.get(User, row.user_id) is not None)
        # Legacy links without declared foreign keys also contain identities.
        counts['users.employer_id'] = db.query(User).filter_by(employer_id=row.user_id).count()
    if row.email:
        for table in Base.metadata.sorted_tables:
            if table.name in ('users', 'account_deletion_requests'):
                continue
            for column in table.c:
                if column.name == 'email' or column.name.endswith('_email'):
                    count = db.scalar(select(func.count()).select_from(table).where(func.lower(column) == row.email.lower()))
                    if count:
                        counts[table.name + '.' + column.name] = count
    return counts


def hold(db: Session, row: AccountDeletionRequest, retention_summary: str) -> None:
    if row.status not in ('pending_review', 'on_hold') or not row.verified_at:
        raise ValueError('Only verified requests can enter a retention hold')
    if not retention_summary.strip():
        raise ValueError('A retention basis, scope and review date are required')
    row.status = 'on_hold'
    row.retention_summary = retention_summary
    db.commit()


def complete(db: Session, row: AccountDeletionRequest, evidence: dict) -> None:
    if row.status not in ('pending_review', 'on_hold') or not row.verified_at:
        raise ValueError('Only verified requests may be completed')
    required = ('database', 'providers', 'backups', 'retained_data')
    if not isinstance(evidence, dict) or any(not isinstance(evidence.get(key), str) or not evidence[key].strip() for key in required):
        raise ValueError('Database, provider, backup and retained-data evidence references are required')
    if any(inventory(db, row).values()):
        raise ValueError('Account or directly linked records still exist; complete the reviewed erasure/anonymization plan first')
    row.completion_evidence = json.dumps({key: evidence[key] for key in required})
    row.retention_summary = evidence['retained_data']
    row.completed_at = datetime.utcnow()
    row.status = 'completed'
    # Avoid keeping identity/reason/token data after completion merely because
    # it passed through the queue. Evidence references must not contain PII.
    row.email = row.reason = row.verification_hash = None
    row.user_id = None
    row.verification_expires_at = None
    db.commit()


def page(db: Session, *, after: str | None = None, limit: int = 100, include_unverified: bool = False) -> dict:
    """Keyset pagination remains stable when preceding requests are completed."""
    if not 1 <= limit <= 100:
        raise ValueError('limit must be between 1 and 100')
    query = db.query(AccountDeletionRequest).filter(AccountDeletionRequest.status != 'completed')
    if not include_unverified:
        query = query.filter(AccountDeletionRequest.verified_at.isnot(None), AccountDeletionRequest.status.in_(('pending_review', 'on_hold')))
    if after is not None:
        try:
            if len(after) > 256:
                raise ValueError('oversized cursor')
            created, request_id = json.loads(base64.urlsafe_b64decode(after.encode()).decode())
            created = datetime.fromisoformat(created)
            if created.tzinfo is not None or not isinstance(request_id, str) or len(request_id) != 36:
                raise ValueError('invalid cursor')
        except (ValueError, TypeError, UnicodeError):
            raise ValueError('Invalid queue cursor') from None
        query = query.filter(or_(AccountDeletionRequest.created_at > created, and_(AccountDeletionRequest.created_at == created, AccountDeletionRequest.id > request_id)))
    rows = query.order_by(AccountDeletionRequest.created_at, AccountDeletionRequest.id).limit(limit + 1).all()
    visible = rows[:limit]
    cursor = None
    if len(rows) > limit:
        last = visible[-1]
        cursor = base64.urlsafe_b64encode(json.dumps([last.created_at.isoformat(), last.id]).encode()).decode()
    return {'requests': [{'id': row.id, 'status': row.status, 'created_at': row.created_at.isoformat(), 'notification_sent': bool(row.notification_sent_at)} for row in visible],
            'next_cursor': cursor}
