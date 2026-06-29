"""Billing / Premium subscription tests.

Covers the paywall money path without touching Stripe's network:
- /billing/status shape
- _require_premium gating (402 for free, served for premium)
- checkout endpoint guards (503 unconfigured, 409 already-premium, happy path)
- webhook signature verification + the plan flips it drives

Webhook events are signed locally with a known test secret, so
stripe.Webhook.construct_event (pure crypto, no network) accepts them.
Anything that would hit api.stripe.com is monkeypatched.
"""
import hashlib
import hmac
import json
import time

import pytest

from .conftest import register_user, auth_headers

WEBHOOK_SECRET = "whsec_test_secret_for_billing_tests"


def _sign(event: dict, secret: str = WEBHOOK_SECRET):
    """Build a (payload, Stripe-Signature header) pair the way Stripe does."""
    payload = json.dumps(event).encode()
    ts = int(time.time())
    signed = str(ts).encode() + b"." + payload
    sig = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return payload, f"t={ts},v1={sig}"


def _configure_billing(monkeypatch):
    """Mark Stripe as configured so checkout/webhook don't short-circuit 503."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_dummy")
    monkeypatch.setattr(settings, "stripe_price_id", "price_dummy")
    monkeypatch.setattr(settings, "stripe_webhook_secret", WEBHOOK_SECRET)


def _set_plan(db_session, user_id: int, plan: str):
    from app.models.user import User
    row = db_session.query(User).filter(User.id == user_id).first()
    row.plan = plan
    db_session.commit()


# ── /billing/status ──────────────────────────────────────────────────────────

def test_billing_status_for_free_user(client):
    token, _ = register_user(client)
    r = client.get("/api/billing/status", headers=auth_headers(token))
    assert r.status_code == 200
    body = r.json()
    assert body["plan"] == "free"
    assert body["is_premium"] is False
    assert body["billing_configured"] is False  # unconfigured in tests by default
    assert body["trial_days"] == 7              # config default


# ── _require_premium gating ──────────────────────────────────────────────────

@pytest.mark.parametrize("path", [
    "/api/consumer/catalog/wines",
    "/api/consumer/catalog/beers",
    "/api/consumer/meal-plan",
    "/api/consumer/shopping-list",
])
def test_premium_get_endpoints_blocked_for_free_user(client, path):
    token, _ = register_user(client)
    r = client.get(path, headers=auth_headers(token))
    assert r.status_code == 402, f"{path} should be Premium-gated"


def test_post_wine_pairing_blocked_for_free_user(client):
    token, _ = register_user(client)
    r = client.post(
        "/api/consumer/wine-pairing",
        json={"dish_name": "Grilled Steak"},
        headers=auth_headers(token),
    )
    assert r.status_code == 402


def test_premium_endpoint_served_for_premium_user(client, db_session):
    token, user = register_user(client)
    assert client.get("/api/consumer/catalog/wines",
                      headers=auth_headers(token)).status_code == 402
    _set_plan(db_session, user["id"], "premium")
    r = client.get("/api/consumer/catalog/wines", headers=auth_headers(token))
    assert r.status_code == 200
    assert "wines" in r.json()


# ── checkout endpoint ────────────────────────────────────────────────────────

def test_checkout_returns_503_when_billing_unconfigured(client):
    token, _ = register_user(client)
    r = client.post("/api/billing/checkout", headers=auth_headers(token))
    assert r.status_code == 503


def test_checkout_returns_session_url(client, monkeypatch):
    from app.services import stripe_service
    monkeypatch.setattr(stripe_service, "is_configured", lambda: True)
    monkeypatch.setattr(stripe_service, "get_or_create_customer", lambda user: "cus_test")
    monkeypatch.setattr(stripe_service, "create_checkout_session",
                        lambda user, cid: "https://checkout.stripe.com/c/test")
    token, _ = register_user(client)
    r = client.post("/api/billing/checkout", headers=auth_headers(token))
    assert r.status_code == 200
    assert r.json()["url"].startswith("https://checkout.stripe.com")


def test_checkout_blocked_for_existing_premium_user(client, db_session, monkeypatch):
    from app.services import stripe_service
    monkeypatch.setattr(stripe_service, "is_configured", lambda: True)
    token, user = register_user(client)
    _set_plan(db_session, user["id"], "premium")
    r = client.post("/api/billing/checkout", headers=auth_headers(token))
    assert r.status_code == 409


def test_checkout_session_includes_free_trial(monkeypatch):
    """create_checkout_session must request a subscription with the trial."""
    from app.core.config import settings
    from app.services import stripe_service
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_dummy")
    monkeypatch.setattr(settings, "stripe_price_id", "price_dummy")
    monkeypatch.setattr(settings, "stripe_trial_days", 7)

    captured = {}

    class _FakeSession:
        url = "https://checkout.stripe.com/c/fake"

    def _fake_create(**kwargs):
        captured.update(kwargs)
        return _FakeSession()

    monkeypatch.setattr(stripe_service._stripe.checkout.Session, "create", _fake_create)

    class _FakeUser:
        id = 1

    url = stripe_service.create_checkout_session(_FakeUser(), "cus_test")
    assert url == "https://checkout.stripe.com/c/fake"
    assert captured["mode"] == "subscription"
    assert captured["line_items"][0]["price"] == "price_dummy"
    assert captured["subscription_data"]["trial_period_days"] == 7


# ── webhook ──────────────────────────────────────────────────────────────────

def test_webhook_rejects_invalid_signature(client, monkeypatch):
    _configure_billing(monkeypatch)
    r = client.post(
        "/api/billing/webhook",
        content=b'{"type":"checkout.session.completed"}',
        headers={"stripe-signature": "t=1,v1=deadbeef"},
    )
    assert r.status_code == 400


def test_webhook_checkout_completed_grants_premium(client, monkeypatch):
    _configure_billing(monkeypatch)
    # retrieve_subscription would hit the network — return a fake instead.
    from app.services import stripe_service
    monkeypatch.setattr(stripe_service, "retrieve_subscription",
                        lambda sid: {"status": "trialing", "current_period_end": 1900000000})
    token, user = register_user(client)

    event = {
        "id": "evt_checkout",
        "type": "checkout.session.completed",
        "data": {"object": {
            "customer": "cus_abc",
            "subscription": "sub_abc",
            "client_reference_id": str(user["id"]),
            "metadata": {"user_id": str(user["id"])},
        }},
    }
    payload, sig = _sign(event)
    r = client.post("/api/billing/webhook", content=payload,
                    headers={"stripe-signature": sig})
    assert r.status_code == 200

    status = client.get("/api/billing/status", headers=auth_headers(token)).json()
    assert status["is_premium"] is True
    assert status["subscription_status"] == "trialing"


def test_webhook_subscription_deleted_downgrades_user(client, monkeypatch):
    _configure_billing(monkeypatch)
    from app.services import stripe_service
    monkeypatch.setattr(stripe_service, "retrieve_subscription",
                        lambda sid: {"status": "active", "current_period_end": 1900000000})
    token, user = register_user(client)

    # Grant Premium first (also sets stripe_customer_id for the lookup).
    grant = {
        "id": "evt_checkout",
        "type": "checkout.session.completed",
        "data": {"object": {
            "customer": "cus_abc",
            "subscription": "sub_abc",
            "client_reference_id": str(user["id"]),
            "metadata": {"user_id": str(user["id"])},
        }},
    }
    payload, sig = _sign(grant)
    client.post("/api/billing/webhook", content=payload,
                headers={"stripe-signature": sig})
    assert client.get("/api/billing/status",
                      headers=auth_headers(token)).json()["is_premium"] is True

    # Cancellation — resolved by stripe_customer_id.
    cancel = {
        "id": "evt_cancel",
        "type": "customer.subscription.deleted",
        "data": {"object": {"customer": "cus_abc", "id": "sub_abc"}},
    }
    payload, sig = _sign(cancel)
    r = client.post("/api/billing/webhook", content=payload,
                    headers={"stripe-signature": sig})
    assert r.status_code == 200

    status = client.get("/api/billing/status", headers=auth_headers(token)).json()
    assert status["is_premium"] is False
    assert status["subscription_status"] == "canceled"
