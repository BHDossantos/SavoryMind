"""Webhook failure regressions; signatures local, no provider requests."""
import pytest

pytestmark = pytest.mark.usefixtures("block_stripe_subscription_network")

from app.models.user import User
from app.services import stripe_service
from .conftest import register_user, auth_headers
from .test_billing import _configure_billing, _sign, subscription_snapshot


def deliver(client, event):
    payload, signature = _sign(event)
    return client.post("/api/billing/webhook", content=payload,
                       headers={"stripe-signature": signature})


@pytest.mark.parametrize("snapshot", [None, {}])
def test_checkout_verification_failure_preserves_state_and_allows_retry(client, db_session, monkeypatch, snapshot):
    _configure_billing(monkeypatch)
    token, registered = register_user(client)
    user = db_session.get(User, registered["id"])
    user.stripe_customer_id = "cus_prior"
    db_session.commit()
    event = {"type": "checkout.session.completed", "data": {"object": {
        "customer": "cus_prior", "subscription": "sub_new", "client_reference_id": str(user.id)}}}
    monkeypatch.setattr(stripe_service, "retrieve_subscription", lambda _: snapshot)
    assert deliver(client, event).status_code == 503
    db_session.refresh(user)
    assert user.plan == "free"
    assert user.stripe_subscription_id is None
    assert user.subscription_status is None
    monkeypatch.setattr(stripe_service, "retrieve_subscription", lambda _: subscription_snapshot(sid="sub_new", customer="cus_prior"))
    assert deliver(client, event).status_code == 200
    assert client.get("/api/billing/status", headers=auth_headers(token)).json()["is_premium"]


def test_database_failure_rolls_back_and_is_not_acknowledged(client, db_session, monkeypatch):
    _configure_billing(monkeypatch)
    _, registered = register_user(client)
    from app.api.routes import billing
    def fail(db, event):
        row = db.get(User, registered["id"])
        row.plan = "premium"
        db.flush()
        raise RuntimeError("sensitive database details")
    monkeypatch.setattr(billing, "_apply_event", fail)
    response = deliver(client, {"type": "customer.subscription.updated", "data": {"object": {}}})
    assert response.status_code == 503
    assert "sensitive" not in response.text
    db_session.expire_all()
    assert db_session.get(User, registered["id"]).plan == "free"


def test_late_old_subscription_deletion_does_not_revoke_replacement(client, db_session, monkeypatch):
    _configure_billing(monkeypatch)
    _, registered = register_user(client)
    row = db_session.get(User, registered["id"])
    row.stripe_customer_id = "cus_owner"
    row.stripe_subscription_id = "sub_replacement"
    row.subscription_status = "active"
    row.plan = "premium"
    db_session.commit()
    event = {"type": "customer.subscription.deleted", "data": {"object": {
        "customer": "cus_owner", "id": "sub_old"}}}
    assert deliver(client, event).status_code == 200
    db_session.refresh(row)
    assert row.plan == "premium"
    assert row.stripe_subscription_id == "sub_replacement"
    event["data"]["object"]["id"] = "sub_replacement"
    assert deliver(client, event).status_code == 200
    db_session.refresh(row)
    assert row.plan == "free"
