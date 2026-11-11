from datetime import datetime, timedelta

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.models import Appointment
from conftest import make_provider, signup, tomorrow_at
from test_booking import book


def test_signup_cannot_create_admin(client):
    response = client.post('/auth/signup', json={
        'email': 'admin@evil.test', 'password': 'password123',
        'first_name': 'Admin', 'role': 'admin',
    })
    assert response.status_code == 422


def test_unsigned_webhook_disabled(client):
    assert client.post('/payments/webhook', json={
        'type': 'checkout.session.completed', 'data': {'object': {'metadata': {'payment_id': '1'}}}
    }).status_code == 404


@pytest.mark.parametrize('state', ['cancelled', 'expired'])
def test_late_stub_confirmation_rejected(client, session, state):
    provider = make_provider(client, session, deposit_cents=1000)
    customer = signup(client, 'customer@test.io')
    result = book(client, customer, provider['service_id'], tomorrow_at(10)).json()
    if state == 'cancelled':
        assert client.post(f"/appointments/{result['appointment']['id']}/cancel", headers=customer).status_code == 200
    else:
        appt = session.get(Appointment, result['appointment']['id'])
        appt.created_at = datetime.utcnow() - timedelta(hours=1)
        session.add(appt)
        session.commit()
    assert client.post(f"/payments/stub-confirm/{result['payment_id']}", headers=customer).status_code == 409


def test_unapproved_provider_cannot_be_booked(client, session):
    provider = make_provider(client, session, approved=False)
    customer = signup(client, 'customer@test.io')
    assert book(client, customer, provider['service_id'], tomorrow_at(10)).status_code == 404


def test_booking_normalizes_offset_to_utc(client, session):
    provider = make_provider(client, session)
    customer = signup(client, 'customer@test.io')
    response = book(client, customer, provider['service_id'], tomorrow_at(12) + '+02:00')
    assert response.status_code == 200
    assert response.json()['appointment']['start_at'] == tomorrow_at(10)


@pytest.mark.parametrize('options', [
    {'environment': 'production'},
    {'integrations_mode': 'live'},
    {'environment': 'production', 'integrations_mode': 'live',
     'stripe_secret_key': 'test', 'stripe_webhook_secret': 'test', 'resend_api_key': 'test'},
])
def test_unsafe_runtime_configuration_fails_closed(options):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **options)


def test_keys_alone_do_not_enable_live_integrations():
    settings = Settings(_env_file=None, stripe_secret_key='test', resend_api_key='test')
    assert settings.integrations_mode == 'stub'


@pytest.mark.parametrize('duration,price,deposit', [(0,2500,0),(-30,2500,0),(30,-1,0),(30,2500,-1),(30,2500,3000)])
def test_invalid_service_rejected(client, session, duration, price, deposit):
    provider = make_provider(client, session)
    assert client.post('/services', headers=provider['headers'], json={
        'name': 'Invalid', 'duration_minutes': duration, 'price_cents': price,
        'deposit_amount_cents': deposit,
    }).status_code == 422


def test_duplicate_stub_confirmation_is_idempotent(client, session):
    provider = make_provider(client, session, deposit_cents=1000)
    customer = signup(client, 'customer@test.io')
    result = book(client, customer, provider['service_id'], tomorrow_at(10)).json()
    for _ in range(2):
        assert client.post(f"/payments/stub-confirm/{result['payment_id']}", headers=customer).json()['status'] == 'paid'


def test_stub_payment_belongs_to_customer(client, session):
    provider = make_provider(client, session, deposit_cents=1000)
    customer = signup(client, 'customer@test.io')
    stranger = signup(client, 'stranger@test.io')
    result = book(client, customer, provider['service_id'], tomorrow_at(10)).json()
    assert client.post(f"/payments/stub-confirm/{result['payment_id']}", headers=stranger).status_code == 404


@pytest.mark.parametrize('approved', [True, False])
def test_direct_service_lookup_respects_approval(client, session, approved):
    provider = make_provider(client, session, approved=approved, city='Another City')
    response = client.get(f"/services/{provider['service_id']}")
    assert response.status_code == (200 if approved else 404)


@pytest.mark.parametrize('case,status', [('valid', 200), ('wrong_amount', 400), ('wrong_session', 400), ('unpaid', 200)])
def test_verified_webhook_matches_checkout(client, session, monkeypatch, case, status):
    from app.models import Payment, PaymentStatus
    from app.routers import payments
    provider = make_provider(client, session, deposit_cents=1000)
    customer = signup(client, 'customer@test.io')
    result = book(client, customer, provider['service_id'], tomorrow_at(10)).json()
    payment = session.get(Payment, result['payment_id'])
    data = {'id': payment.provider_session_id, 'amount_total': 1000, 'currency': 'eur',
            'payment_status': 'paid', 'metadata': {'payment_id': str(payment.id)}}
    if case == 'wrong_amount':
        data['amount_total'] = 1
    if case == 'wrong_session':
        data['id'] = 'unrelated'
    if case == 'unpaid':
        data['payment_status'] = 'unpaid'
    monkeypatch.setattr(payments, 'is_stub_mode', lambda: False)
    monkeypatch.setattr(payments, 'verify_webhook', lambda *_: {'type': 'checkout.session.completed', 'data': {'object': data}})
    assert client.post('/payments/webhook', json={}).status_code == status
    session.refresh(payment)
    assert payment.status == (PaymentStatus.paid if case == 'valid' else PaymentStatus.pending)
