from datetime import datetime, timedelta, timezone
import httpx
import pytest
from .conftest import register_user, auth_headers
from app.core.config import settings
from app.services import store_billing

@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setattr(settings, 'revenuecat_secret_api_key', 'server-test-key')
    monkeypatch.setattr(settings, 'revenuecat_products', {'test_premium': 'premium', 'test_pro': 'pro'})
    data = {'test_premium': {'store': 'play_store', 'store_transaction_id': 'GPA.test', 'expires_date': (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(), 'is_sandbox': False}}
    requests = []
    def handle(request):
        requests.append(request)
        return httpx.Response(200, json={'subscriber': {'subscriptions': data}})
    monkeypatch.setattr(store_billing, '_client', lambda: httpx.Client(transport=httpx.MockTransport(handle)))
    return data, requests


def test_native_membership_is_verified_on_server_and_idempotent(client, db_session, provider):
    from app.models.store_membership import StoreMembership, StoreReceipt
    token, user = register_user(client)
    response = client.post('/api/billing/store/sync', headers=auth_headers(token), json={'plan': 'pro', 'app_user_id': 'other'})
    assert response.status_code == 200, response.text
    assert response.json()['granted'] and response.json()['plan'] == 'premium'
    row = db_session.get(StoreMembership, user['id'])
    assert provider[1][-1].url.path.endswith('/' + row.app_user_id)
    assert row.app_user_id != str(user['id'])
    assert client.post('/api/billing/store/sync', headers=auth_headers(token)).status_code == 200
    assert db_session.query(StoreReceipt).count() == 1


def test_receipt_cannot_be_claimed_by_second_account(client, provider):
    a, _ = register_user(client)
    b, _ = register_user(client, email='bob@example.com')
    assert client.post('/api/billing/store/sync', headers=auth_headers(a)).status_code == 200
    assert client.post('/api/billing/store/sync', headers=auth_headers(b)).status_code == 409


@pytest.mark.parametrize('change', [{'expires_date': '2020-01-01T00:00:00Z'}, {'refunded_at': '2026-01-01T00:00:00Z'}, {'is_sandbox': True}, {'store': 'promotional'}])
def test_expired_refunded_sandbox_or_nonstore_receipt_cannot_grant(client, provider, change):
    provider[0]['test_premium'].update(change)
    token, _ = register_user(client)
    response = client.post('/api/billing/store/sync', headers=auth_headers(token))
    assert response.status_code == 200
    assert not response.json()['granted']
    assert response.json()['plan'] == 'free'


def test_refund_removes_existing_native_access(client, provider):
    token, _ = register_user(client)
    assert client.post('/api/billing/store/sync', headers=auth_headers(token)).json()['granted']
    provider[0]['test_premium']['refunded_at'] = '2026-01-01T00:00:00Z'
    assert client.get('/api/billing/store/context', headers=auth_headers(token)).json()['plan'] == 'free'


def test_temporary_verification_failure_recovers_without_new_charge(client, provider, monkeypatch):
    token, _ = register_user(client)
    original = store_billing._client
    monkeypatch.setattr(store_billing, '_client', lambda: httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(503))))
    assert client.post('/api/billing/store/sync', headers=auth_headers(token)).status_code == 503
    monkeypatch.setattr(store_billing, '_client', original)
    assert client.post('/api/billing/store/sync', headers=auth_headers(token)).json()['granted']


def test_existing_stripe_subscription_blocks_double_purchase(client, db_session, provider):
    from app.models.user import User
    token, user = register_user(client)
    row = db_session.get(User, user['id'])
    row.subscription_status = 'active'
    row.plan = 'premium'
    db_session.commit()
    provider[0].clear()
    response = client.get('/api/billing/store/context', headers=auth_headers(token))
    assert response.json()['plan'] == 'premium'
    assert not response.json()['can_purchase']


def test_expiry_applies_without_needing_restore(client, db_session, provider):
    from app.models.store_membership import StoreMembership
    token, user = register_user(client)
    assert client.post('/api/billing/store/sync', headers=auth_headers(token)).json()['granted']
    row = db_session.get(StoreMembership, user['id'])
    row.expires_at = datetime.utcnow() - timedelta(seconds=1)
    db_session.commit()
    assert client.get('/api/billing/status', headers=auth_headers(token)).json()['plan'] == 'free'


def test_webhook_requires_authorization_and_requeries_status(client, provider, monkeypatch):
    token, _ = register_user(client)
    response = client.post('/api/billing/store/sync', headers=auth_headers(token))
    app_id = response.json()['app_user_id']
    monkeypatch.setattr(settings, 'revenuecat_webhook_authorization', 'test-webhook-auth')
    body = {'event': {'app_user_id': app_id, 'plan': 'pro'}}
    assert client.post('/api/billing/store/webhook', json=body).status_code == 403
    provider[0]['test_premium']['refunded_at'] = '2026-01-01T00:00:00Z'
    assert client.post('/api/billing/store/webhook', json=body, headers={'Authorization': 'test-webhook-auth'}).status_code == 200
    assert client.get('/api/billing/status', headers=auth_headers(token)).json()['plan'] == 'free'


def test_unconfigured_store_is_not_offered(client):
    token, _ = register_user(client)
    assert not client.get('/api/billing/store/context', headers=auth_headers(token)).json()['enabled']
    assert client.post('/api/billing/store/sync', headers=auth_headers(token)).status_code == 503
