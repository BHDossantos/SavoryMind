"""Restaurant €99/mo subscription billing tests.

Mirrors the consumer billing suite but for the restaurant plan: the
checkout endpoint is restaurant-only and 503s until the restaurant Price
is configured, the status endpoint reports the right shape, and the
webhook flips a restaurant's plan to "pro" (not "premium") when its
subscription goes active. Nothing here touches Stripe's network —
checkout/portal are monkeypatched; the webhook is signed locally.
"""
import hashlib
import hmac
import json
import time

import pytest

from .conftest import register_user, auth_headers

WEBHOOK_SECRET = "whsec_test_secret_for_restaurant_billing"


def _sign(event: dict, secret: str = WEBHOOK_SECRET):
    payload = json.dumps(event).encode()
    ts = int(time.time())
    signed = str(ts).encode() + b"." + payload
    sig = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return payload, f"t={ts},v1={sig}"


def _configure_restaurant_billing(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_dummy")
    monkeypatch.setattr(settings, "stripe_restaurant_price_id", "price_restaurant_dummy")
    monkeypatch.setattr(settings, "stripe_webhook_secret", WEBHOOK_SECRET)


def _register_restaurant(client, email="owner@example.com"):
    token, user = register_user(client, email=email, account_type="restaurant")
    return token, user


# ── /billing/restaurant/status ───────────────────────────────────────────────

def test_restaurant_status_for_free_restaurant(client):
    token, _ = _register_restaurant(client)
    r = client.get("/api/billing/restaurant/status", headers=auth_headers(token))
    assert r.status_code == 200
    body = r.json()
    assert body["plan"] == "free"
    assert body["is_pro"] is False
    assert body["billing_configured"] is False  # unconfigured in tests
    assert body["trial_days"] == 0              # config default


def test_restaurant_status_rejects_non_restaurant(client):
    token, _ = register_user(client, email="diner@example.com", account_type="consumer")
    r = client.get("/api/billing/restaurant/status", headers=auth_headers(token))
    assert r.status_code == 403


# ── /billing/restaurant/checkout ─────────────────────────────────────────────

def test_restaurant_checkout_503_when_unconfigured(client):
    token, _ = _register_restaurant(client)
    r = client.post("/api/billing/restaurant/checkout", headers=auth_headers(token))
    assert r.status_code == 503


def test_restaurant_checkout_403_for_consumer(client, monkeypatch):
    _configure_restaurant_billing(monkeypatch)
    token, _ = register_user(client, email="c@example.com", account_type="consumer")
    r = client.post("/api/billing/restaurant/checkout", headers=auth_headers(token))
    assert r.status_code == 403


def test_restaurant_checkout_happy_path(client, monkeypatch):
    _configure_restaurant_billing(monkeypatch)
    token, _ = _register_restaurant(client)

    from app.services import stripe_service
    monkeypatch.setattr(stripe_service, "get_or_create_customer", lambda u: "cus_rest_123")
    monkeypatch.setattr(
        stripe_service, "create_restaurant_checkout_session",
        lambda u, cid: "https://checkout.stripe.com/c/rest_session",
    )
    r = client.post("/api/billing/restaurant/checkout", headers=auth_headers(token))
    assert r.status_code == 200
    assert r.json()["url"] == "https://checkout.stripe.com/c/rest_session"


def test_restaurant_checkout_409_when_already_pro(client, monkeypatch):
    _configure_restaurant_billing(monkeypatch)
    token, user = _register_restaurant(client)
    # Flip to pro directly.
    from app.models.user import User
    from app.core.database import SessionLocal
    db = SessionLocal()
    db.query(User).filter(User.id == user["id"]).update({"plan": "pro"})
    db.commit(); db.close()
    r = client.post("/api/billing/restaurant/checkout", headers=auth_headers(token))
    assert r.status_code == 409


# ── webhook → restaurant entitlement ─────────────────────────────────────────

def test_webhook_sets_restaurant_to_pro_not_premium(client, monkeypatch):
    """A subscription.updated for a restaurant account must grant 'pro',
    never 'premium' — the two products are distinct."""
    _configure_restaurant_billing(monkeypatch)
    token, user = _register_restaurant(client)

    # Attach a known customer id so the webhook resolves this user.
    from app.models.user import User
    from app.core.database import SessionLocal
    db = SessionLocal()
    db.query(User).filter(User.id == user["id"]).update({"stripe_customer_id": "cus_rest_123"})
    db.commit(); db.close()

    event = {
        "type": "customer.subscription.updated",
        "data": {"object": {
            "id": "sub_rest_1",
            "customer": "cus_rest_123",
            "status": "active",
            "current_period_end": int(time.time()) + 30 * 86400,
        }},
    }
    payload, sig = _sign(event)
    r = client.post(
        "/api/billing/webhook",
        data=payload,
        headers={"stripe-signature": sig, "content-type": "application/json"},
    )
    assert r.status_code == 200

    db = SessionLocal()
    row = db.query(User).filter(User.id == user["id"]).first()
    plan, status = row.plan, row.subscription_status
    db.close()
    assert plan == "pro"
    assert status == "active"


def test_webhook_canceled_reverts_restaurant_to_free(client, monkeypatch):
    _configure_restaurant_billing(monkeypatch)
    token, user = _register_restaurant(client)

    from app.models.user import User
    from app.core.database import SessionLocal
    db = SessionLocal()
    db.query(User).filter(User.id == user["id"]).update(
        {"stripe_customer_id": "cus_rest_9", "plan": "pro"}
    )
    db.commit(); db.close()

    event = {
        "type": "customer.subscription.deleted",
        "data": {"object": {"id": "sub_rest_9", "customer": "cus_rest_9", "status": "canceled"}},
    }
    payload, sig = _sign(event)
    r = client.post(
        "/api/billing/webhook",
        data=payload,
        headers={"stripe-signature": sig, "content-type": "application/json"},
    )
    assert r.status_code == 200

    db = SessionLocal()
    row = db.query(User).filter(User.id == user["id"]).first()
    plan = row.plan
    db.close()
    assert plan == "free"
