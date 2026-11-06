from datetime import datetime
import pytest
from app.models.user import User
from app.models.consumer import WinePairing
from app.models.account_deletion import AccountDeletionRequest
from app.models.account_erasure import AccountErasureRun
from app.services import account_erasure, deletion_queue
from .conftest import register_user, auth_headers


def request_for(db, user):
    row = AccountDeletionRequest(user_id=user['id'], email=user['email'], verified_at=datetime.utcnow(), status='pending_review')
    db.add(row)
    db.commit()
    return row


def test_private_erasure_dry_run_then_reviewed_execution_and_session_revocation(client, db_session):
    token, user = register_user(client)
    _, other = register_user(client, email='other@example.com')
    db_session.add(WinePairing(user_id=user['id'], dish_name='private', recommendations='[]'))
    db_session.add(WinePairing(user_id=other['id'], dish_name='keep', recommendations='[]'))
    db_session.commit()
    other_count = db_session.query(WinePairing).filter_by(user_id=other['id']).count()
    row = request_for(db_session, user)
    preview = account_erasure.plan(db_session, row)
    assert preview['supported'] and preview['delete_counts']['wine_pairings.user_id'] >= 1
    assert user['email'] not in str(preview)
    assert db_session.get(User, user['id']) is not None
    assert db_session.get(AccountErasureRun, row.id) is None
    account_erasure.prepare(db_session, row, expected_sha=preview['plan_sha'], policy_ref='approved-policy-v1')
    db_session.commit()
    with pytest.raises(ValueError, match='evidence'):
        account_erasure.erase_private_database(db_session, row.id, expected_sha=preview['plan_sha'], evidence={})
    db_session.rollback()
    evidence = {key: 'reviewed-evidence-ref' for key in ('providers', 'backups', 'retained_data')}
    result = account_erasure.erase_private_database(db_session, row.id, expected_sha=preview['plan_sha'], evidence=evidence)
    db_session.commit()
    assert result['state'] == 'database_erased'
    assert client.get('/api/auth/me', headers=auth_headers(token)).status_code == 401
    assert db_session.query(WinePairing).filter_by(user_id=other['id']).count() == other_count
    assert account_erasure.erase_private_database(db_session, row.id, expected_sha=preview['plan_sha'], evidence=evidence)['replayed']
    deletion_queue.complete(db_session, row, {**evidence, 'database': 'local-erasure-run-reference'})
    assert row.status == 'completed' and row.email is None and row.user_id is None


def test_shared_or_business_records_require_separate_policy_review(client, db_session):
    _, user = register_user(client, account_type='restaurant')
    row = request_for(db_session, user)
    preview = account_erasure.plan(db_session, row)
    assert not preview['supported']
    with pytest.raises(ValueError):
        account_erasure.prepare(db_session, row, expected_sha=preview['plan_sha'], policy_ref='cannot-authorize-shared-data')
    assert db_session.get(User, user['id']) is not None


def test_stale_plan_cannot_delete_newly_added_private_records(client, db_session):
    _, user = register_user(client)
    row = request_for(db_session, user)
    preview = account_erasure.plan(db_session, row)
    account_erasure.prepare(db_session, row, expected_sha=preview['plan_sha'], policy_ref='approved-policy-v1')
    db_session.commit()
    db_session.add(WinePairing(user_id=user['id'], dish_name='new', recommendations='[]'))
    db_session.commit()
    with pytest.raises(ValueError, match='no longer matches'):
        account_erasure.erase_private_database(db_session, row.id, expected_sha=preview['plan_sha'], evidence={key: 'ref' for key in ('providers', 'backups', 'retained_data')})
    assert db_session.get(User, user['id']) is not None


def test_shared_booking_cannot_be_deleted_as_private_account_data(client, db_session):
    from datetime import date
    from app.models.restaurant_ext import Booking
    _, diner = register_user(client)
    _, restaurant = register_user(client, email='restaurant@example.com', account_type='restaurant')
    booking = Booking(user_id=restaurant['id'], diner_user_id=diner['id'], customer_name='Shared guest', customer_email=diner['email'], date=date.today(), time_slot='19:00', party_size=2)
    db_session.add(booking)
    db_session.commit()
    row = request_for(db_session, diner)
    preview = account_erasure.plan(db_session, row)
    assert preview['blockers']['bookings.diner_user_id'] == 1
    assert preview['blockers']['bookings.customer_email'] == 1
    with pytest.raises(ValueError):
        account_erasure.prepare(db_session, row, expected_sha=preview['plan_sha'], policy_ref='private-only')
    assert db_session.get(Booking, booking.id).customer_name == 'Shared guest'


def test_retention_hold_blocks_even_a_previously_prepared_erasure(client, db_session):
    _, user = register_user(client)
    row = request_for(db_session, user)
    preview = account_erasure.plan(db_session, row)
    account_erasure.prepare(db_session, row, expected_sha=preview['plan_sha'], policy_ref='reviewed-private-scope')
    db_session.commit()
    deletion_queue.hold(db_session, row, 'Review pending: retain under documented policy')
    with pytest.raises(ValueError):
        account_erasure.reprepare(db_session, row.id, previous_sha=preview['plan_sha'], expected_sha=preview['plan_sha'], policy_ref='new-policy', review_ref='cannot-override-hold')
    with pytest.raises(ValueError):
        account_erasure.erase_private_database(db_session, row.id, expected_sha=preview['plan_sha'], evidence={key: 'ref' for key in ('providers', 'backups', 'retained_data')})
    assert db_session.get(User, user['id']) is not None


def test_committed_hold_in_another_session_is_refreshed_before_erasure(client, db_session):
    from sqlalchemy.orm import Session
    _, user = register_user(client)
    row = request_for(db_session, user)
    preview = account_erasure.plan(db_session, row)
    account_erasure.prepare(db_session, row, expected_sha=preview['plan_sha'], policy_ref='reviewed-private-scope')
    db_session.commit()
    assert row.status == 'pending_review'
    with Session(db_session.get_bind()) as other:
        held = other.get(AccountDeletionRequest, row.id)
        held.status = 'on_hold'
        other.commit()
    assert row.status == 'pending_review'  # stale identity-map snapshot
    with pytest.raises(ValueError):
        account_erasure.erase_private_database(db_session, row.id, expected_sha=preview['plan_sha'], evidence={key: 'ref' for key in ('providers', 'backups', 'retained_data')})
    assert db_session.get(User, user['id']) is not None


def test_active_billing_cannot_be_orphaned_by_private_erasure(client, db_session):
    _, user = register_user(client)
    account = db_session.get(User, user['id'])
    account.subscription_status = 'active'
    db_session.commit()
    row = request_for(db_session, user)
    preview = account_erasure.plan(db_session, row)
    assert preview['blockers']['active_external_billing_requires_review'] == 1
    with pytest.raises(ValueError):
        account_erasure.prepare(db_session, row, expected_sha=preview['plan_sha'], policy_ref='private-data-only')


def test_stale_plan_can_be_rereviewed_with_audit(client, db_session):
    from app.models.account_erasure import AccountErasureReview
    _, user = register_user(client)
    row = request_for(db_session, user)
    old = account_erasure.plan(db_session, row)['plan_sha']
    run = account_erasure.prepare(db_session, row, expected_sha=old, policy_ref='v1')
    run.evidence = 'obsolete'
    db_session.commit()
    db_session.add(WinePairing(user_id=user['id'], dish_name='new', recommendations='[]'))
    db_session.commit()
    new = account_erasure.plan(db_session, row)['plan_sha']
    assert new != old
    args = dict(previous_sha=old, expected_sha=new, policy_ref='v2', review_ref='ticket')
    with pytest.raises(ValueError):
        account_erasure.reprepare(db_session, row.id, **{**args, 'previous_sha': 'wrong'})
    account_erasure.reprepare(db_session, row.id, **args)
    db_session.commit()
    account_erasure.reprepare(db_session, row.id, **args)
    reviews = db_session.query(AccountErasureReview).filter_by(request_id=row.id).all()
    assert len(reviews) == 1
    assert (reviews[0].previous_plan_sha, reviews[0].new_plan_sha) == (old, new)
    assert (reviews[0].previous_policy_ref, reviews[0].new_policy_ref) == ('v1', 'v2')
    assert run.evidence is None
    evidence = {key: 'ref' for key in account_erasure.EVIDENCE}
    with pytest.raises(ValueError):
        account_erasure.erase_private_database(db_session, row.id, expected_sha=old, evidence=evidence)
    account_erasure.erase_private_database(db_session, row.id, expected_sha=new, evidence=evidence)
    db_session.commit()
    with pytest.raises(ValueError, match='cannot be reset'):
        account_erasure.reprepare(db_session, row.id, **args)


def test_erased_highest_id_tokens_cannot_authenticate_new_signup(client, db_session):
    token, user = register_user(client)
    refresh = client.cookies.get('sm_refresh')
    assert refresh
    row = request_for(db_session, user)
    sha = account_erasure.plan(db_session, row)['plan_sha']
    account_erasure.prepare(db_session, row, expected_sha=sha, policy_ref='reviewed')
    db_session.commit()
    account_erasure.erase_private_database(db_session, row.id, expected_sha=sha, evidence={key: 'ref' for key in account_erasure.EVIDENCE})
    db_session.commit()
    _, replacement = register_user(client, email='replacement@example.com')
    assert replacement['id'] > user['id']
    assert client.get('/api/auth/me', headers=auth_headers(token)).status_code == 401
    from app.services.auth_service import refresh_session
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as error:
        refresh_session(db_session, refresh)
    assert error.value.status_code == 401


def test_legacy_sqlite_without_nonreusable_ids_blocks_erasure(client, db_session, monkeypatch):
    _, user = register_user(client)
    row = request_for(db_session, user)
    original = db_session.scalar
    def scalar(statement, *args, **kwargs):
        if 'sqlite_master' in str(statement):
            return 'CREATE TABLE users (id INTEGER PRIMARY KEY)'
        return original(statement, *args, **kwargs)
    monkeypatch.setattr(db_session, 'scalar', scalar)
    preview = account_erasure.plan(db_session, row)
    assert preview['blockers']['unsafe_reusable_sqlite_user_identity'] == 1
    with pytest.raises(ValueError):
        account_erasure.prepare(db_session, row, expected_sha=preview['plan_sha'], policy_ref='reviewed')


def test_sqlite_identity_migration_preserves_rows_and_prevents_reuse():
    import importlib.util
    from pathlib import Path
    from sqlalchemy import create_engine, text
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    path = Path(__file__).parents[1] / 'alembic/versions/a31d11e70005_sqlite_user_ids.py'
    spec = importlib.util.spec_from_file_location('identity_migration', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    engine = create_engine('sqlite://')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR NOT NULL UNIQUE)'))
        connection.execute(text("INSERT INTO users VALUES (42, 'retained@example.com')"))
        module.op = Operations(MigrationContext.configure(connection))
        module.upgrade()
        assert connection.scalar(text('SELECT id FROM users')) == 42
        assert connection.scalar(text('SELECT email FROM users')) == 'retained@example.com'
        connection.execute(text('DELETE FROM users'))
        connection.execute(text("INSERT INTO users(email) VALUES ('new@example.com')"))
        assert connection.scalar(text('SELECT id FROM users')) == 43
        module.downgrade()
        assert 'AUTOINCREMENT' in connection.scalar(text("SELECT sql FROM sqlite_master WHERE name='users'"))

        connection.execute(text('DELETE FROM users'))
        module.upgrade()
        connection.execute(text("INSERT INTO users(email) VALUES ('after-reupgrade@example.com')"))
        assert connection.scalar(text('SELECT id FROM users')) == 44


@pytest.mark.parametrize('enforcement', [0, 1])
@pytest.mark.parametrize('action', ['CASCADE', 'RESTRICT'])
def test_identity_migration_preserves_referencing_children(enforcement, action):
    import importlib.util
    from pathlib import Path
    from sqlalchemy import create_engine, text, event
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    path = Path(__file__).parents[1] / 'alembic/versions/a31d11e70005_sqlite_user_ids.py'
    spec = importlib.util.spec_from_file_location('identity_migration', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    engine = create_engine('sqlite://')
    with engine.connect() as connection:
        connection.execute(text(f'PRAGMA foreign_keys={enforcement}'))
        assert connection.scalar(text('PRAGMA foreign_keys')) == enforcement
        connection.execute(text('CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR NOT NULL UNIQUE)'))
        connection.execute(text(f'CREATE TABLE child (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE {action}, payload VARCHAR)'))
        connection.execute(text("INSERT INTO users VALUES (42, 'retained@example.com')"))
        connection.execute(text("INSERT INTO child VALUES (7, 42, 'preserve-entitlement')"))
        connection.commit()
        statements = []
        def record(conn, cursor, statement, parameters, context, executemany):
            statements.append(statement.strip().upper())
        event.listen(connection, 'before_cursor_execute', record)
        module.op = Operations(MigrationContext.configure(connection))
        for operation in (module.upgrade, module.downgrade, module.upgrade):
            statements.clear()
            if enforcement and operation == module.upgrade:
                with pytest.raises(RuntimeError, match='no users-table DDL performed'):
                    operation()
                assert not any(s.startswith(('CREATE ', 'DROP ', 'ALTER ', 'INSERT ', 'UPDATE ', 'DELETE ')) for s in statements)
            else:
                operation()
            connection.commit()
            assert connection.execute(text('SELECT id, email FROM users')).all() == [(42, 'retained@example.com')]
            assert connection.execute(text('SELECT id, user_id, payload FROM child')).all() == [(7, 42, 'preserve-entitlement')]
            assert connection.execute(text('PRAGMA foreign_key_check')).all() == []
            assert connection.scalar(text('PRAGMA foreign_keys')) == enforcement
            assert connection.scalar(text("SELECT count(*) FROM sqlite_master WHERE name='_alembic_tmp_users'")) == 0
        # Already migrated tables require no rebuild even with enforcement on.
        if not enforcement:
            connection.commit()
            connection.execute(text('PRAGMA foreign_keys=ON'))
            assert connection.scalar(text('PRAGMA foreign_keys')) == 1
            statements.clear()
            module.upgrade()
            assert not any(s.startswith(('CREATE ', 'DROP ', 'ALTER ')) for s in statements)
            assert connection.scalar(text('SELECT payload FROM child')) == 'preserve-entitlement'
