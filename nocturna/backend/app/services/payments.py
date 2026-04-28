"""Stripe payments service.

Defaults to a mock checkout when STRIPE_SECRET_KEY is unset so the user
flow still works in local dev. Real Stripe is used when the env var is
set, with full webhook signature verification and event-level idempotency.
"""
from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Booking, Payment, Subscription, User, WebhookEvent
from app.services import notifications, templates

log = logging.getLogger("nocturna.payments")

STRIPE_SECRET_KEY = os.getenv("NOCTURNA_STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("NOCTURNA_STRIPE_WEBHOOK_SECRET")
APP_BASE_URL = os.getenv("NOCTURNA_APP_BASE_URL", "http://localhost:3001")

_stripe = None
if STRIPE_SECRET_KEY:
    try:
        import stripe  # type: ignore

        stripe.api_key = STRIPE_SECRET_KEY
        _stripe = stripe
    except ImportError:
        log.warning("stripe package not installed; falling back to mock checkout")
        _stripe = None


PRICE_TABLE = {
    "instant_plan": {"label": "Instant Curated Plan", "amount_eur": 4.99},
    "premium_date": {"label": "Premium Date Night Plan", "amount_eur": 19.99},
    "vip_concierge_basic": {"label": "VIP Concierge — Basic", "amount_eur": 49.0},
    "vip_concierge_pro": {"label": "VIP Concierge — Pro", "amount_eur": 99.0},
    "subscription_user": {"label": "Nocturna Premium", "amount_eur": 9.99, "recurring": True},
    "subscription_venue_basic": {"label": "Venue Basic", "amount_eur": 99.0, "recurring": True},
    "subscription_venue_pro": {"label": "Venue Pro", "amount_eur": 299.0, "recurring": True},
    "subscription_venue_premium": {"label": "Venue Premium", "amount_eur": 799.0, "recurring": True},
}


def is_stripe_configured() -> bool:
    return _stripe is not None


# Checkout session ----------------------------------------------------------


def create_checkout_session(
    db: Session,
    *,
    purpose: str,
    amount_eur: Optional[float] = None,
    user_id: Optional[int] = None,
    plan_id: Optional[int] = None,
    booking_id: Optional[int] = None,
    venue_id: Optional[int] = None,
    metadata: Optional[dict] = None,
    success_path: str = "/payments/success",
    cancel_path: str = "/payments/cancelled",
) -> dict:
    info = PRICE_TABLE.get(purpose, {"label": purpose, "amount_eur": amount_eur or 0})
    amount = float(amount_eur if amount_eur is not None else info["amount_eur"])
    payment = Payment(
        user_id=user_id, plan_id=plan_id, booking_id=booking_id,
        venue_id=venue_id, purpose=purpose, amount_eur=amount, status="pending",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    if _stripe:
        params = {
            "mode": "subscription" if info.get("recurring") else "payment",
            "line_items": [
                {
                    "price_data": {
                        "currency": "eur",
                        "product_data": {"name": info["label"]},
                        "unit_amount": int(round(amount * 100)),
                        **({"recurring": {"interval": "month"}} if info.get("recurring") else {}),
                    },
                    "quantity": 1,
                }
            ],
            "success_url": f"{APP_BASE_URL}{success_path}?payment_id={payment.id}&session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{APP_BASE_URL}{cancel_path}?payment_id={payment.id}",
            "metadata": {**(metadata or {}), "payment_id": str(payment.id), "purpose": purpose},
        }
        if user_id:
            user = db.query(User).get(user_id)
            if user and user.email:
                params["customer_email"] = user.email
        try:
            session = _stripe.checkout.Session.create(**params)
        except Exception as e:
            log.exception("stripe checkout failed")
            payment.status = "failed"
            payment.failure_message = str(e)
            db.commit()
            raise
        payment.stripe_session_id = session.id
        db.commit()
        return {"checkout_url": session.url, "payment_id": payment.id, "stripe": True}

    fake_session = f"mock_{secrets.token_hex(8)}"
    payment.stripe_session_id = fake_session
    db.commit()
    return {
        "checkout_url": f"{APP_BASE_URL}/payments/mock?payment_id={payment.id}",
        "payment_id": payment.id,
        "stripe": False,
    }


# Webhook + idempotency -----------------------------------------------------


def verify_webhook(payload: bytes, sig: str):
    """Verify Stripe webhook signature and parse the event.

    Raises ValueError when the signature is invalid OR webhook is unconfigured.
    Returns the parsed event when valid.
    """
    if not (_stripe and STRIPE_WEBHOOK_SECRET):
        raise ValueError("stripe webhook not configured")
    if not sig:
        raise ValueError("missing stripe-signature header")
    try:
        return _stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        raise ValueError(f"invalid signature: {e}") from e


def already_processed(db: Session, event_id: str) -> bool:
    return db.query(WebhookEvent).filter(WebhookEvent.event_id == event_id).first() is not None


def _record_event(db: Session, event: dict) -> WebhookEvent:
    row = WebhookEvent(
        provider="stripe",
        event_id=event["id"],
        event_type=event["type"],
        payload=event,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def handle_webhook_event(db: Session, event: dict) -> dict:
    """Dispatch a Stripe event to the right handler. Idempotent on event id."""
    event_id = event.get("id")
    if not event_id:
        return {"ignored": True, "reason": "no_id"}
    if already_processed(db, event_id):
        return {"ignored": True, "reason": "duplicate", "event_id": event_id}

    etype = event.get("type", "")
    obj = (event.get("data") or {}).get("object") or {}
    payment = _resolve_payment(db, obj)

    handler = {
        "checkout.session.completed": _on_checkout_completed,
        "checkout.session.async_payment_succeeded": _on_checkout_completed,
        "payment_intent.succeeded": _on_payment_succeeded,
        "invoice.payment_succeeded": _on_invoice_paid,
        "payment_intent.payment_failed": _on_payment_failed,
        "charge.refunded": _on_refunded,
        "customer.subscription.created": _on_subscription_change,
        "customer.subscription.updated": _on_subscription_change,
        "customer.subscription.deleted": _on_subscription_deleted,
    }.get(etype)

    result = {"event_id": event_id, "type": etype}
    if handler:
        try:
            handler(db, event, obj, payment)
            result["handled"] = True
        except Exception as e:
            log.exception("handler %s failed for event %s", etype, event_id)
            result["handled"] = False
            result["error"] = str(e)
    else:
        result["handled"] = False
        result["reason"] = "unhandled_type"

    if payment:
        payment.last_stripe_event_id = event_id
        payment.last_event_type = etype
        db.commit()
    _record_event(db, event)
    return result


def _resolve_payment(db: Session, obj: dict) -> Optional[Payment]:
    """Find the Payment row this Stripe object refers to."""
    pid = (obj.get("metadata") or {}).get("payment_id")
    if pid:
        try:
            p = db.query(Payment).get(int(pid))
            if p:
                return p
        except (TypeError, ValueError):
            pass
    sid = obj.get("id") or ""
    if sid.startswith("cs_"):
        return db.query(Payment).filter(Payment.stripe_session_id == sid).first()
    if sid.startswith("pi_"):
        p = db.query(Payment).filter(Payment.stripe_payment_intent_id == sid).first()
        if p:
            return p
    pi = obj.get("payment_intent")
    if pi:
        return db.query(Payment).filter(Payment.stripe_payment_intent_id == pi).first()
    return None


# Event handlers ------------------------------------------------------------


def _on_checkout_completed(db: Session, event: dict, obj: dict, payment: Optional[Payment]):
    if not payment:
        log.warning("checkout.completed for unknown payment: %s", obj.get("id"))
        return
    payment.stripe_payment_intent_id = obj.get("payment_intent") or payment.stripe_payment_intent_id
    payment.status = "succeeded"
    db.commit()
    _apply_payment_side_effects(db, payment, obj)
    _send_receipt(db, payment, obj)


def _on_payment_succeeded(db: Session, event: dict, obj: dict, payment: Optional[Payment]):
    if not payment:
        return
    payment.status = "succeeded"
    charges = (obj.get("charges") or {}).get("data") or []
    if charges:
        payment.receipt_url = charges[0].get("receipt_url") or payment.receipt_url
    db.commit()
    _apply_payment_side_effects(db, payment, obj)
    _send_receipt(db, payment, obj)


def _on_invoice_paid(db: Session, event: dict, obj: dict, payment: Optional[Payment]):
    if not payment:
        return
    payment.status = "succeeded"
    payment.receipt_url = obj.get("hosted_invoice_url") or payment.receipt_url
    db.commit()
    _apply_payment_side_effects(db, payment, obj)
    _send_receipt(db, payment, obj)


def _on_payment_failed(db: Session, event: dict, obj: dict, payment: Optional[Payment]):
    if not payment:
        return
    payment.status = "failed"
    err = (obj.get("last_payment_error") or {}).get("message") or obj.get("failure_message")
    payment.failure_message = err
    db.commit()
    if payment.user_id:
        user = db.query(User).get(payment.user_id)
        if user and user.email:
            label = PRICE_TABLE.get(payment.purpose, {}).get("label", payment.purpose)
            subject, body = templates.payment_failed(label, payment.amount_eur, err, payment.id)
            notifications.send_email(db, user.email, subject, body, user_id=user.id, plan_id=payment.plan_id)


def _on_refunded(db: Session, event: dict, obj: dict, payment: Optional[Payment]):
    if not payment:
        return
    payment.status = "refunded"
    db.commit()


def _on_subscription_change(db: Session, event: dict, obj: dict, payment: Optional[Payment]):
    sub_id = obj.get("id")
    customer_id = obj.get("customer")
    user_id = (obj.get("metadata") or {}).get("user_id")
    if not user_id and payment:
        user_id = payment.user_id
    if not user_id:
        return
    sub = db.query(Subscription).filter(Subscription.stripe_subscription_id == sub_id).first()
    if not sub:
        sub = db.query(Subscription).filter(Subscription.user_id == int(user_id)).first()
    if not sub:
        sub = Subscription(user_id=int(user_id), tier="premium_user")
        db.add(sub)
    sub.stripe_subscription_id = sub_id
    sub.stripe_customer_id = customer_id
    sub.status = obj.get("status", sub.status)
    sub.cancel_at_period_end = bool(obj.get("cancel_at_period_end"))
    cpe = obj.get("current_period_end")
    if cpe:
        sub.current_period_end = datetime.utcfromtimestamp(int(cpe))
    db.commit()


def _on_subscription_deleted(db: Session, event: dict, obj: dict, payment: Optional[Payment]):
    sub_id = obj.get("id")
    sub = db.query(Subscription).filter(Subscription.stripe_subscription_id == sub_id).first()
    if sub:
        sub.status = "cancelled"
        db.commit()


# Side effects shared between webhook + mock confirm ------------------------


def mark_payment_succeeded(db: Session, payment_id: int, stripe_payment_intent_id: Optional[str] = None) -> Payment:
    p = db.query(Payment).get(payment_id)
    if not p:
        raise ValueError("payment not found")
    if p.status == "succeeded":
        return p  # idempotent
    p.status = "succeeded"
    if stripe_payment_intent_id:
        p.stripe_payment_intent_id = stripe_payment_intent_id
    db.commit()
    db.refresh(p)
    _apply_payment_side_effects(db, p, {})
    _send_receipt(db, p, {})
    return p


def _apply_payment_side_effects(db: Session, p: Payment, stripe_obj: dict):
    if p.purpose == "subscription_user" and p.user_id:
        sub = db.query(Subscription).filter(Subscription.user_id == p.user_id).first()
        if not sub:
            sub = Subscription(user_id=p.user_id, tier="premium_user", status="active")
            db.add(sub)
        else:
            sub.tier = "premium_user"
            sub.status = "active"
        db.commit()
    elif p.purpose.startswith("subscription_venue_") and p.user_id:
        tier_map = {
            "subscription_venue_basic": "venue_basic",
            "subscription_venue_pro": "venue_pro",
            "subscription_venue_premium": "venue_premium",
        }
        sub = db.query(Subscription).filter(Subscription.user_id == p.user_id).first()
        if not sub:
            sub = Subscription(user_id=p.user_id, tier=tier_map[p.purpose], status="active")
            db.add(sub)
        else:
            sub.tier = tier_map[p.purpose]
            sub.status = "active"
        db.commit()
    if p.purpose in ("vip_concierge_basic", "vip_concierge_pro") and p.booking_id:
        booking = db.query(Booking).get(p.booking_id)
        if booking and booking.status == "new":
            booking.status = "pending"
            booking.admin_notes = (booking.admin_notes or "") + "\n[concierge paid]"
            db.commit()


def _send_receipt(db: Session, p: Payment, stripe_obj: dict):
    if not p.user_id:
        return
    user = db.query(User).get(p.user_id)
    if not user or not user.email:
        return
    label = PRICE_TABLE.get(p.purpose, {}).get("label", p.purpose)
    subject, body = templates.payment_receipt(label, p.amount_eur, p.currency, p.id, p.receipt_url)
    notifications.send_email(db, user.email, subject, body, user_id=user.id, plan_id=p.plan_id, booking_id=p.booking_id)
