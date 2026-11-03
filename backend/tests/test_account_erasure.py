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
