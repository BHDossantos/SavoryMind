"""Configured-price/customer identity checks; provider access is blocked."""
import pytest
from app.core.config import settings
from app.models.user import User
from app.services import stripe_service
from .conftest import register_user
from .test_billing import _configure_billing, subscription_snapshot
from .test_billing_delivery import deliver

pytestmark = pytest.mark.usefixtures("block_stripe_subscription_network")

@pytest.fixture
def owner(client, db_session, monkeypatch):
    _configure_billing(monkeypatch)
    monkeypatch.setattr(settings, "stripe_restaurant_price_id", "price_restaurant")
    _, registered = register_user(client)
    user = db_session.get(User, registered["id"])
    user.stripe_customer_id = "cus_abc"
    db_session.commit()
    return user

def event(user, checkout=False):
    return {"type": "checkout.session.completed" if checkout else "customer.subscription.updated", "data": {"object": {
        "id": "sub_abc", "customer": "cus_abc", "subscription": "sub_abc", "client_reference_id": str(user.id), "status": "active"}}}

@pytest.mark.parametrize("price", ["price_dummy", "price_unknown"])
def test_restaurant_never_gets_pro_for_consumer_or_unknown_price(client, db_session, monkeypatch, owner, price):
    owner.account_type = "restaurant"
    owner.plan = "pro"  # includes historical incorrectly granted entitlement
    owner.stripe_subscription_id = "sub_abc"
    db_session.commit()
    monkeypatch.setattr(stripe_service, "retrieve_subscription", lambda _: subscription_snapshot(price=price))
    assert deliver(client, event(owner)).status_code == 200
    db_session.refresh(owner)
    assert owner.plan == "free"

@pytest.mark.parametrize("field,value", [("customer", "cus_other"), ("id", "sub_other"), ("items", {})])
def test_unverified_provider_identity_preserves_existing_state_and_retries(client, db_session, monkeypatch, owner, field, value):
    snapshot = subscription_snapshot()
    snapshot[field] = value
    monkeypatch.setattr(stripe_service, "retrieve_subscription", lambda _: snapshot)
    assert deliver(client, event(owner, True)).status_code == 503
    db_session.refresh(owner)
    assert owner.plan == "free" and owner.stripe_subscription_id is None

@pytest.mark.parametrize("kind", ["foreign_reference", "unbound", "conflicting_metadata"])
def test_metadata_never_claims_or_rebinds_customer(client, db_session, monkeypatch, owner, kind):
    payload = event(owner, True)
    if kind == "foreign_reference": payload["data"]["object"]["client_reference_id"] = str(owner.id + 1)
    if kind == "unbound":
        owner.stripe_customer_id = None
        db_session.commit()
    if kind == "conflicting_metadata": payload["data"]["object"]["metadata"] = {"user_id": str(owner.id + 1)}
    def no_retrieve(_): raise AssertionError("Identity rejection must happen before provider access")
    monkeypatch.setattr(stripe_service, "retrieve_subscription", no_retrieve)
    assert deliver(client, payload).status_code == 503
    db_session.refresh(owner)
    assert owner.plan == "free" and owner.stripe_subscription_id is None
    assert owner.stripe_customer_id == (None if kind == "unbound" else "cus_abc")

def test_stale_active_event_uses_current_provider_status(client, db_session, monkeypatch, owner):
    calls = []
    def retrieve(sid):
        calls.append(sid)
        return subscription_snapshot(status="canceled")
    monkeypatch.setattr(stripe_service, "retrieve_subscription", retrieve)
    assert deliver(client, event(owner)).status_code == 200
    db_session.refresh(owner)
    assert owner.plan == "free" and owner.subscription_status == "canceled"
    assert calls == ["sub_abc"]

def test_expanded_customer_and_item_period_are_supported(client, db_session, monkeypatch, owner):
    snapshot = subscription_snapshot()
    snapshot["customer"] = {"id": "cus_abc"}
    snapshot.pop("current_period_end")
    snapshot["items"]["data"][0]["current_period_end"] = 1900000000
    monkeypatch.setattr(stripe_service, "retrieve_subscription", lambda _: snapshot)
    assert deliver(client, event(owner)).status_code == 200
    db_session.refresh(owner)
    assert owner.plan == "premium"
    assert owner.subscription_period_end == stripe_service.period_end_to_datetime(1900000000)

@pytest.mark.parametrize("change", ["unknown_price", "multiple_items", "quantity_zero"])
def test_unsupported_product_cannot_grant_premium(client, db_session, monkeypatch, owner, change):
    snapshot = subscription_snapshot()
    if change == "unknown_price": snapshot["items"]["data"][0]["price"]["id"] = "price_other"
    if change == "multiple_items": snapshot["items"]["data"] *= 2
    if change == "quantity_zero": snapshot["items"]["data"][0]["quantity"] = 0
    monkeypatch.setattr(stripe_service, "retrieve_subscription", lambda _: snapshot)
    assert deliver(client, event(owner)).status_code == 200
    db_session.refresh(owner)
    assert owner.plan == "free"

def test_ambiguous_price_configuration_is_retryable(client, db_session, monkeypatch, owner):
    monkeypatch.setattr(settings, "stripe_restaurant_price_id", settings.stripe_price_id)
    monkeypatch.setattr(stripe_service, "retrieve_subscription", lambda _: subscription_snapshot())
    assert deliver(client, event(owner)).status_code == 503
    db_session.refresh(owner)
    assert owner.plan == "free"
