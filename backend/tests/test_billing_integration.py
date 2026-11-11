"""Regression coverage for the native-billing and verified-Stripe integration."""
import pytest

from app.services import stripe_service
from .test_billing import subscription_snapshot
from .test_billing_delivery import deliver
from .test_billing_identity import owner, event
from .conftest import auth_headers
from datetime import datetime, timedelta
from app.models.store_membership import StoreMembership
from app.core.security import create_access_token

pytestmark = pytest.mark.usefixtures("block_stripe_subscription_network")


@pytest.mark.parametrize("checkout", [True, False])
@pytest.mark.parametrize("previous,current", [(False, True), (True, False)])
def test_verified_snapshot_updates_cancellation_state(
    client, db_session, monkeypatch, owner, checkout, previous, current
):
    owner.subscription_cancel_at_period_end = previous
    db_session.commit()
    snapshot = subscription_snapshot()
    snapshot["cancel_at_period_end"] = current
    monkeypatch.setattr(stripe_service, "retrieve_subscription", lambda _: snapshot)

    assert deliver(client, event(owner, checkout)).status_code == 200
    db_session.refresh(owner)
    assert owner.subscription_cancel_at_period_end is current
    assert owner.plan == "premium"


def test_unverified_snapshot_does_not_change_cancellation_state(
    client, db_session, monkeypatch, owner
):
    owner.subscription_cancel_at_period_end = True
    db_session.commit()
    snapshot = subscription_snapshot(customer="cus_foreign")
    snapshot["cancel_at_period_end"] = False
    monkeypatch.setattr(stripe_service, "retrieve_subscription", lambda _: snapshot)

    assert deliver(client, event(owner)).status_code == 503
    db_session.refresh(owner)
    assert owner.subscription_cancel_at_period_end is True
    assert owner.plan == "free"


@pytest.mark.parametrize("price,expected", [("price_unknown", "free"), ("price_dummy", "premium")])
def test_native_expiry_uses_only_verified_stripe_entitlement(
    client, db_session, monkeypatch, owner, price, expected
):
    # A signed Stripe event can describe an active but unrecognized price.
    # That status alone must not undo the configured-price check after a
    # native subscription expires.
    native = StoreMembership(user_id=owner.id, status="active", store="play_store",
                             expires_at=datetime.utcnow() + timedelta(days=1))
    db_session.add(native)
    db_session.commit()
    token = create_access_token(owner.id, owner.email)
    monkeypatch.setattr(stripe_service, "retrieve_subscription",
                        lambda _: subscription_snapshot(price=price))
    assert deliver(client, event(owner)).status_code == 200
    assert client.get('/api/billing/status', headers=auth_headers(token)).json()['plan'] == 'premium'
    db_session.refresh(native)
    native.expires_at = datetime.utcnow() - timedelta(seconds=1)
    db_session.commit()
    assert client.get('/api/billing/status', headers=auth_headers(token)).json()['plan'] == expected


def test_stripe_deletion_preserves_independently_active_native_membership(
    client, db_session, owner
):
    owner.stripe_subscription_id = 'sub_abc'
    owner.stripe_verified_plan = 'premium'
    owner.subscription_status = 'active'
    db_session.add(StoreMembership(user_id=owner.id, status='active', store='play_store',
                                   expires_at=datetime.utcnow() + timedelta(days=1)))
    db_session.commit()
    payload = {'type': 'customer.subscription.deleted', 'data': {'object': {
        'id': 'sub_abc', 'customer': 'cus_abc'}}}
    assert deliver(client, payload).status_code == 200
    db_session.refresh(owner)
    assert owner.stripe_verified_plan == 'free'
    assert owner.plan == 'premium'
