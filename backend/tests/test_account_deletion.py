from datetime import datetime, timedelta
import re
from unittest.mock import patch
from .conftest import register_user, auth_headers


def rows(db):
    from app.models.account_deletion import AccountDeletionRequest
    return db.query(AccountDeletionRequest)


def test_authenticated_intake_is_durable_even_when_mail_fails(client, db_session):
    token, user = register_user(client)
    with patch('app.api.routes.account.resend_client.send_email', return_value=False):
        response = client.post('/api/account/deletion', headers=auth_headers(token), json={'email': 'victim@example.com'})
    assert response.status_code == 200, response.text
    row = rows(db_session).one()
    assert row.user_id == user['id']
    assert row.email == user['email']
    assert row.status == 'pending_review' and row.verified_at
    assert row.notification_sent_at is None
    assert 'Deletion has not been confirmed' in response.json()['message']


def test_authenticated_retries_deduplicate_and_notification_retries(client, db_session):
    token, _ = register_user(client)
    with patch('app.api.routes.account.resend_client.send_email', side_effect=[False, True]) as send:
        first = client.post('/api/account/deletion', headers=auth_headers(token), json={})
        second = client.post('/api/account/deletion', headers=auth_headers(token), json={})
    assert first.json()['request_id'] == second.json()['request_id']
    assert rows(db_session).count() == 1
    assert rows(db_session).one().notification_sent_at is not None
    assert send.call_count == 2


def test_authenticated_intake_requires_login_and_status_is_private(client):
    assert client.post('/api/account/deletion', json={}).status_code in (401, 403)
    a, _ = register_user(client)
    b, _ = register_user(client, email='bob@example.com')
    with patch('app.api.routes.account.resend_client.send_email', return_value=False):
        client.post('/api/account/deletion', headers=auth_headers(a), json={})
    assert client.get('/api/account/deletion', headers=auth_headers(b)).json()['status'] == 'none'


def request_token(client, email):
    with patch('app.api.routes.account.resend_client.send_email', return_value=True) as send:
        response = client.post('/api/account/delete-request', json={'email': email, 'reason': '<script>untrusted</script>'})
    assert response.status_code == 200
    html = send.call_args.kwargs['html']
    assert '<script>' not in html
    return re.search(r'#token=([^"<]+)', html).group(1), response.json()


def test_public_intake_needs_email_verification_and_token_is_one_time(client, db_session):
    _, user = register_user(client)
    token, _ = request_token(client, user['email'])
    row = rows(db_session).one()
    assert row.status == 'awaiting_verification'
    assert row.user_id is None
    assert row.verification_hash != token and len(row.verification_hash) == 64
    with patch('app.api.routes.account.resend_client.send_email', return_value=False):
        response = client.post('/api/account/delete-request/verify', json={'token': token})
    assert response.status_code == 200
    db_session.expire_all()
    row = rows(db_session).one()
    assert row.user_id == user['id'] and row.status == 'pending_review'
    assert row.verification_hash is None
    assert client.post('/api/account/delete-request/verify', json={'token': token}).status_code == 400


def test_expired_token_does_not_make_request_actionable(client, db_session):
    token, _ = request_token(client, 'person@example.com')
    row = rows(db_session).one()
    row.verification_expires_at = datetime.utcnow() - timedelta(seconds=1)
    db_session.commit()
    assert client.post('/api/account/delete-request/verify', json={'token': token}).status_code == 400
    assert rows(db_session).one().status == 'awaiting_verification'


def test_public_delivery_failure_keeps_durable_unverified_request(client, db_session):
    with patch('app.api.routes.account.resend_client.send_email', return_value=False):
        response = client.post('/api/account/delete-request', json={'email': 'person@example.com'})
    assert response.status_code == 503
    assert rows(db_session).one().status == 'awaiting_verification'


def test_public_response_does_not_enumerate_accounts(client):
    _, user = register_user(client)
    _, existing = request_token(client, user['email'])
    _, nonexistent = request_token(client, 'nobody@example.com')
    assert existing == nonexistent


def test_public_request_cannot_reset_verified_identity_or_reason(client, db_session):
    token, user = register_user(client)
    with patch('app.api.routes.account.resend_client.send_email', return_value=True):
        client.post('/api/account/deletion', headers=auth_headers(token), json={'reason': 'my request'})
        client.post('/api/account/delete-request', json={'email': user['email'], 'reason': 'attacker'})
    row = rows(db_session).one()
    assert row.reason == 'my request' and row.status == 'pending_review'
    assert row.verification_hash is None


def test_operator_cannot_complete_before_erasure_or_without_evidence(client, db_session):
    import pytest
    from app.services import deletion_queue
    token, _ = register_user(client)
    with patch('app.api.routes.account.resend_client.send_email', return_value=False):
        client.post('/api/account/deletion', headers=auth_headers(token), json={})
    row = rows(db_session).one()
    with pytest.raises(ValueError, match='evidence'):
        deletion_queue.complete(db_session, row, {})
    with pytest.raises(ValueError, match='still exist'):
        deletion_queue.complete(db_session, row, dict(database='ticket/db', providers='ticket/vendor', backups='ticket/backup', retained_data='none'))
    deletion_queue.hold(db_session, row, 'financial records: owner must approve basis and expiry before erasure')
    assert row.status == 'on_hold'


def test_completion_redacts_queue_identity_only_after_evidence(client, db_session):
    from app.services import deletion_queue
    token, _ = request_token(client, 'no-account@example.com')
    with patch('app.api.routes.account.resend_client.send_email', return_value=False):
        assert client.post('/api/account/delete-request/verify', json={'token': token}).status_code == 200
    row = rows(db_session).one()
    deletion_queue.complete(db_session, row, dict(database='review/no-account', providers='review/no-record', backups='review/no-record', retained_data='none'))
    assert row.status == 'completed'
    assert row.email is None and row.reason is None and row.user_id is None
