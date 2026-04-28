"""Webhook idempotency + dispatch + receipt-email side effects.

Stripe SDK is not invoked in tests — we feed pre-parsed event dicts directly
to handle_webhook_event so we exercise the full pipeline without keys.
"""
from __future__ import annotations

from app.models import NotificationLog, Payment, Subscription, User, WebhookEvent
from app.services import payments as pay


def _make_user(db, email="u@example.com"):
    u = User(email=email, password_hash="x", role="user", name="U")
    db.add(u); db.commit(); db.refresh(u); return u


def _make_payment(db, user, purpose="instant_plan", amount=4.99):
    p = Payment(user_id=user.id, purpose=purpose, amount_eur=amount, status="pending",
                stripe_session_id="cs_test_123")
    db.add(p); db.commit(); db.refresh(p); return p


def _evt(eid, etype, obj):
    return {"id": eid, "type": etype, "data": {"object": obj}}


def test_checkout_completed_marks_payment_and_records_event(db):
    u = _make_user(db)
    p = _make_payment(db, u)
    event = _evt("evt_1", "checkout.session.completed", {
        "id": "cs_test_123", "payment_intent": "pi_42",
        "metadata": {"payment_id": str(p.id)},
    })
    out = pay.handle_webhook_event(db, event)
    assert out["handled"] is True
    db.refresh(p)
    assert p.status == "succeeded"
    assert p.stripe_payment_intent_id == "pi_42"
    assert p.last_stripe_event_id == "evt_1"
    assert db.query(WebhookEvent).filter_by(event_id="evt_1").count() == 1


def test_duplicate_event_is_idempotent(db):
    u = _make_user(db)
    p = _make_payment(db, u)
    event = _evt("evt_dup", "checkout.session.completed", {
        "id": "cs_test_123", "metadata": {"payment_id": str(p.id)}, "payment_intent": "pi_a",
    })
    out1 = pay.handle_webhook_event(db, event)
    assert out1["handled"] is True
    out2 = pay.handle_webhook_event(db, event)
    assert out2["ignored"] is True
    assert out2["reason"] == "duplicate"
    # Still only one webhook_event row
    assert db.query(WebhookEvent).filter_by(event_id="evt_dup").count() == 1


def test_payment_failed_marks_failed_and_emails(db):
    u = _make_user(db, "fail@example.com")
    p = _make_payment(db, u)
    event = _evt("evt_fail", "payment_intent.payment_failed", {
        "id": "pi_x",
        "metadata": {"payment_id": str(p.id)},
        "last_payment_error": {"message": "card declined"},
    })
    pay.handle_webhook_event(db, event)
    db.refresh(p)
    assert p.status == "failed"
    assert "card declined" in (p.failure_message or "")
    emails = db.query(NotificationLog).filter_by(channel="email", recipient="fail@example.com").all()
    assert any("payment didn't go through" in (e.subject or "").lower() for e in emails)


def test_subscription_event_creates_subscription_row(db):
    u = _make_user(db, "sub@example.com")
    p = _make_payment(db, u, purpose="subscription_user", amount=9.99)
    event = _evt("evt_sub", "customer.subscription.created", {
        "id": "sub_abc", "customer": "cus_xyz", "status": "active",
        "current_period_end": 2_000_000_000,
        "cancel_at_period_end": False,
        "metadata": {"payment_id": str(p.id)},
    })
    pay.handle_webhook_event(db, event)
    sub = db.query(Subscription).filter_by(user_id=u.id).first()
    assert sub is not None
    assert sub.stripe_subscription_id == "sub_abc"
    assert sub.status == "active"


def test_unhandled_event_type_is_recorded_but_not_handled(db):
    event = _evt("evt_unk", "customer.created", {"id": "cus_1"})
    out = pay.handle_webhook_event(db, event)
    assert out.get("handled") is False
    assert out.get("reason") == "unhandled_type"
    assert db.query(WebhookEvent).filter_by(event_id="evt_unk").count() == 1


def test_mock_confirm_sends_receipt_email(db):
    u = _make_user(db, "buyer@example.com")
    p = _make_payment(db, u, purpose="premium_date", amount=19.99)
    pay.mark_payment_succeeded(db, p.id)
    db.refresh(p)
    assert p.status == "succeeded"
    assert any(
        "receipt" in (e.subject or "").lower()
        for e in db.query(NotificationLog).filter_by(recipient="buyer@example.com").all()
    )


def test_subscription_purpose_grants_premium_user_tier(db):
    u = _make_user(db, "premium@example.com")
    p = _make_payment(db, u, purpose="subscription_user", amount=9.99)
    pay.mark_payment_succeeded(db, p.id)
    sub = db.query(Subscription).filter_by(user_id=u.id).first()
    assert sub.tier == "premium_user"
    assert sub.status == "active"
