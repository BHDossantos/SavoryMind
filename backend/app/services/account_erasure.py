"""Reviewed local erasure for private consumer/diner accounts.

Shared restaurant/customer/payroll records need a separate retention and
anonymization decision. Unknown relationships fail closed. No provider is called.
"""
import hashlib
import importlib
import json
import pkgutil
from datetime import datetime
from sqlalchemy import select, func, inspect, delete, text
from ..core.database import Base
from ..models.user import User
from ..models.account_erasure import AccountErasureRun, AccountErasureReview
from ..models.account_deletion import AccountDeletionRequest

PRIVATE_TABLES = frozenset({'behavior_logs', 'pantry_items', 'meal_memories', 'wine_pairings', 'music_moods', 'social_connections', 'feature_overrides', 'notifications', 'flavor_memories', 'assistant_conversations', 'store_memberships', 'store_receipts', 'saved_restaurants'})
EVIDENCE = ('providers', 'backups', 'retained_data')


def load_models():
    from .. import models
    for module in pkgutil.iter_modules(models.__path__):
        importlib.import_module(models.__name__ + '.' + module.name)


def plan(db, request):
    load_models()
    if not request.verified_at or request.user_id is None or request.status != 'pending_review':
        raise ValueError('A verified request for an existing account is required')
    user = db.get(User, request.user_id)
    if user is None:
        raise ValueError('Account is absent; inspect the existing run before continuing')
    counts, blockers, row_fingerprints = {}, {}, {}
    if db.get_bind().dialect.name == 'sqlite':
        ddl = db.scalar(text("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")) or ''
        if 'AUTOINCREMENT' not in ddl.upper():
            blockers['unsafe_reusable_sqlite_user_identity'] = 1
    if user.account_type not in ('consumer', 'diner'):
        blockers['account_type_requires_review'] = 1
    if user.subscription_status in ('active', 'trialing', 'past_due'):
        blockers['active_external_billing_requires_review'] = 1
    from ..models.store_membership import StoreMembership
    membership = db.get(StoreMembership, user.id)
    if membership and membership.status == 'active' and membership.expires_at and membership.expires_at > datetime.utcnow():
        blockers['active_store_billing_requires_review'] = 1
    tables = Base.metadata.tables
    unknown = set(inspect(db.get_bind()).get_table_names()) - set(tables) - {'alembic_version'}
    for name in sorted(unknown):
        blockers['unmapped_table:' + name] = 1
    for table in Base.metadata.sorted_tables:
        if table.name in ('users', 'account_deletion_requests', 'account_erasure_runs'):
            continue
        for column in table.c:
            direct = any(fk.target_fullname == 'users.id' for fk in column.foreign_keys)
            legacy = not column.foreign_keys and column.name in ('user_id', 'staff_user_id', 'employee_user_id', 'actor_user_id', 'tenant_user_id')
            if not (direct or legacy):
                continue
            count = db.scalar(select(func.count()).select_from(table).where(column == user.id))
            if not count:
                continue
            key = table.name + '.' + column.name
            private = table.name in PRIVATE_TABLES and column.name == 'user_id'
            revocations = table.name == 'refresh_token_revocations' and column.name == 'user_id'
            (counts if private or revocations else blockers)[key] = count
            if private or revocations:
                rows = db.execute(select(*table.primary_key.columns).where(column == user.id)).all()
                row_fingerprints[key] = sorted([list(map(str, values)) for values in rows])
    dependents = db.query(User).filter_by(employer_id=user.id).count()
    if dependents:
        blockers['users.employer_id'] = dependents
    other_requests = db.query(AccountDeletionRequest).filter(AccountDeletionRequest.user_id == user.id, AccountDeletionRequest.id != request.id).count()
    if other_requests:
        blockers['other_deletion_requests'] = other_requests
    # Email-only associations (CRM, bookings, marketing) are shared records,
    # not proof that a whole restaurant-owned row may be deleted.
    for table in Base.metadata.sorted_tables:
        if table.name in ('users', 'account_deletion_requests'):
            continue
        for column in table.c:
            if column.name == 'email' or column.name.endswith('_email'):
                count = db.scalar(select(func.count()).select_from(table).where(func.lower(column) == user.email.lower()))
                if count:
                    blockers[table.name + '.' + column.name] = count
    # Inspect descendants of approved private rows: a future table must not be
    # silently cascaded away without being covered by the reviewed plan.
    for name in PRIVATE_TABLES:
        parent = tables.get(name)
        if parent is None or 'id' not in parent.c or 'user_id' not in parent.c:
            continue
        owned = select(parent.c.id).where(parent.c.user_id == user.id)
        for table in Base.metadata.sorted_tables:
            for column in table.c:
                if any(fk.target_fullname == name + '.id' for fk in column.foreign_keys):
                    count = db.scalar(select(func.count()).select_from(table).where(column.in_(owned)))
                    if count:
                        blockers[table.name + '.' + column.name + ':indirect'] = count
    summary = {'request_id': request.id, 'delete_counts': counts, 'blockers': blockers, 'required_evidence': list(EVIDENCE), 'supported': not blockers}
    summary['plan_sha'] = hashlib.sha256(json.dumps({'summary': summary, 'rows': row_fingerprints, 'identity': [user.id, user.email, user.created_at.isoformat() if user.created_at else None]}, sort_keys=True).encode()).hexdigest()
    return summary


def prepare(db, request, *, expected_sha, policy_ref):
    current = plan(db, request)
    if current['plan_sha'] != expected_sha or not current['supported']:
        raise ValueError('Plan changed or contains unresolved shared/retention records')
    if not policy_ref or not policy_ref.strip() or len(policy_ref) > 200:
        raise ValueError('A reviewed policy reference is required')
    existing = db.get(AccountErasureRun, request.id)
    if existing:
        if existing.plan_sha != expected_sha or existing.policy_ref != policy_ref:
            raise ValueError('Existing run differs; review it before retrying')
        return existing
    run = AccountErasureRun(request_id=request.id, plan_sha=expected_sha, policy_ref=policy_ref, state='prepared')
    db.add(run)
    db.flush()
    return run


def reprepare(db, request_id, *, previous_sha, expected_sha, policy_ref, review_ref):
    """Replace only a still-prepared plan after explicit, auditable fresh review."""
    request = db.query(AccountDeletionRequest).filter_by(id=request_id).populate_existing().with_for_update().one()
    run = db.query(AccountErasureRun).filter_by(request_id=request_id).populate_existing().with_for_update().one()
    if run.state != 'prepared':
        raise ValueError('Only a prepared run can be re-reviewed; erased runs cannot be reset')
    db.query(User).filter_by(id=request.user_id).populate_existing().with_for_update().one()
    current = plan(db, request)
    if not current['supported'] or current['plan_sha'] != expected_sha:
        raise ValueError('Fresh reviewed plan no longer matches or has blockers')
    if any(not isinstance(value, str) or not value.strip() or len(value) > 200 for value in (policy_ref, review_ref)):
        raise ValueError('Policy and review evidence references are required')
    prior_review = db.query(AccountErasureReview).filter_by(request_id=request_id, previous_plan_sha=previous_sha, new_plan_sha=expected_sha, new_policy_ref=policy_ref, review_ref=review_ref).first()
    if prior_review and run.plan_sha == expected_sha and run.policy_ref == policy_ref:
        return run
    if run.plan_sha != previous_sha:
        raise ValueError('Prepared plan changed since review; refresh the preview')
    if previous_sha == expected_sha and run.policy_ref == policy_ref:
        raise ValueError('Plan is unchanged; use the existing prepared run')
    db.add(AccountErasureReview(request_id=request_id, previous_plan_sha=run.plan_sha, new_plan_sha=expected_sha, previous_policy_ref=run.policy_ref, new_policy_ref=policy_ref, review_ref=review_ref))
    run.plan_sha = expected_sha
    run.policy_ref = policy_ref
    # No earlier completion evidence may authorize the changed row set.
    run.evidence = None
    db.flush()
    return run


def erase_private_database(db, request_id, *, expected_sha, evidence):
    request = db.query(AccountDeletionRequest).filter_by(id=request_id).populate_existing().with_for_update().one()
    run = db.query(AccountErasureRun).filter_by(request_id=request_id).populate_existing().with_for_update().one()
    if run.state == 'database_erased':
        return {'state': run.state, 'replayed': True}
    db.query(User).filter_by(id=request.user_id).populate_existing().with_for_update().one()
    current = plan(db, request)
    if run.plan_sha != expected_sha or current['plan_sha'] != expected_sha or current['blockers']:
        raise ValueError('Reviewed plan no longer matches; no deletion performed')
    if not isinstance(evidence, dict) or any(not isinstance(evidence.get(k), str) or not evidence[k].strip() or len(evidence[k]) > 500 for k in EVIDENCE):
        raise ValueError('Provider, backup and retention evidence references are required')
    # Each predicate is this user's own private rows. Never delete another
    # account or shared restaurant records to satisfy a foreign key.
    for name in sorted(PRIVATE_TABLES | {'refresh_token_revocations'}):
        table = Base.metadata.tables.get(name)
        if table is not None:
            db.execute(delete(table).where(table.c.user_id == request.user_id))
    db.execute(delete(User).where(User.id == request.user_id))
    run.state = 'database_erased'
    run.database_erased_at = datetime.utcnow()
    run.evidence = json.dumps({k: evidence[k] for k in EVIDENCE})
    db.flush()
    return {'state': run.state, 'replayed': False}
