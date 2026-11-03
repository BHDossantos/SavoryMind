"""Operator queue transitions. This module never guesses a retention policy.

Erasure must be performed under a reviewed plan. Recording completion requires
an absent account and explicit database/provider/backup/retention evidence.
"""
import json
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from ..core.database import Base
from ..models.user import User
from ..models.account_deletion import AccountDeletionRequest


def inventory(db: Session, row: AccountDeletionRequest) -> dict:
    counts = {}
    if row.user_id is not None:
        for table in Base.metadata.sorted_tables:
            for column in table.columns:
                if any(fk.target_fullname == 'users.id' for fk in column.foreign_keys):
                    count = db.scalar(select(func.count()).select_from(table).where(column == row.user_id))
                    if count:
                        counts[f'{table.name}.{column.name}'] = count
        counts['users.id'] = int(db.get(User, row.user_id) is not None)
        # Legacy links without declared foreign keys also contain identities.
        counts['users.employer_id'] = db.query(User).filter_by(employer_id=row.user_id).count()
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
