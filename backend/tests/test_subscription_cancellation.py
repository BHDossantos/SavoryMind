from unittest.mock import patch
import pytest
from .conftest import register_user, auth_headers


def subscriber(client, db_session, account_type='consumer'):
    from app.models.user import User
    token, user = register_user(client, account_type=account_type)
    row = db_session.get(User, user['id'])
    row.stripe_customer_id = 'cus_ours'
    row.stripe_subscription_id = 'sub_ours'
    row.plan = 'pro' if account_type == 'restaurant' else 'premium'
    row.subscription_status = 'active'
    db_session.commit()
    return token, row


@pytest.mark.parametrize('kind', ['consumer', 'restaurant'])
def test_cancellation_only_flow_checks_customer_and_confirms_provider(client, db_session, monkeypatch, kind):
    from app.core.config import settings
    from app.services import stripe_service
    monkeypatch.setattr(settings, 'stripe_secret_key', 'test-not-live')
    monkeypatch.setattr(settings, 'stripe_price_id', '')
    monkeypatch.setattr(settings, 'stripe_restaurant_price_id', '')
    token, user = subscriber(client, db_session, kind)
    with patch.object(stripe_service._stripe.Subscription, 'retrieve', return_value={'customer': 'cus_ours', 'status': 'active'}), patch.object(stripe_service._stripe.Subscription, 'modify', return_value={'cancel_at_period_end': True, 'status': 'active'}) as modify:
        response = client.post('/api/billing/cancel', headers=auth_headers(token), json={'subscription_id': 'sub_victim'})
    assert response.status_code == 200, response.text
    assert response.json()['confirmed'] and response.json()['cancel_at_period_end']
    modify.assert_called_once_with('sub_ours', cancel_at_period_end=True)
    db_session.refresh(user)
    assert user.subscription_cancel_at_period_end
    assert user.plan in ('premium', 'pro')  # access is not ended early


def test_foreign_customer_never_reaches_mutation(client, db_session, monkeypatch):
    from app.core.config import settings
    from app.services import stripe_service
    monkeypatch.setattr(settings, 'stripe_secret_key', 'test-not-live')
    token, _ = subscriber(client, db_session)
    with patch.object(stripe_service._stripe.Subscription, 'retrieve', return_value={'customer': 'cus_other'}), patch.object(stripe_service._stripe.Subscription, 'modify') as modify:
        assert client.post('/api/billing/cancel', headers=auth_headers(token)).status_code == 409
    modify.assert_not_called()


def test_outage_does_not_report_cancellation(client, db_session, monkeypatch):
    from app.core.config import settings
    from app.services import stripe_service
    monkeypatch.setattr(settings, 'stripe_secret_key', 'test-not-live')
    token, user = subscriber(client, db_session)
    with patch.object(stripe_service._stripe.Subscription, 'retrieve', side_effect=RuntimeError('do not echo provider secrets')):
        response = client.post('/api/billing/cancel', headers=auth_headers(token))
    assert response.status_code == 502
    assert 'secrets' not in response.text
    db_session.refresh(user)
    assert not user.subscription_cancel_at_period_end


def test_repeated_cancellation_does_not_mutate_again(client, db_session, monkeypatch):
    from app.core.config import settings
    from app.services import stripe_service
    monkeypatch.setattr(settings, 'stripe_secret_key', 'test-not-live')
    token, _ = subscriber(client, db_session)
    with patch.object(stripe_service._stripe.Subscription, 'retrieve', return_value={'customer': 'cus_ours', 'status': 'active', 'cancel_at_period_end': True}), patch.object(stripe_service._stripe.Subscription, 'modify') as modify:
        assert client.post('/api/billing/cancel', headers=auth_headers(token)).json()['confirmed']
    modify.assert_not_called()
