"""Stripe payments service.

Falls back to a mock checkout when STRIPE_SECRET_KEY is not configured so
the user flow still works in local dev. Real Stripe is used when the env
var is set.
"""
from __future__ import annotations

import os
import secrets
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Payment, Subscription

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
        user_id=user_id,
        plan_id=plan_id,
        booking_id=booking_id,
        venue_id=venue_id,
        purpose=purpose,
        amount_eur=amount,
        status="pending",
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
        session = _stripe.checkout.Session.create(**params)
        payment.stripe_session_id = session.id
        db.commit()
        return {"checkout_url": session.url, "payment_id": payment.id, "stripe": True}

    # Mock checkout for local dev — caller can hit /api/payments/{id}/mock-confirm to mark succeeded.
    fake_session = f"mock_{secrets.token_hex(8)}"
    payment.stripe_session_id = fake_session
    db.commit()
    return {
        "checkout_url": f"{APP_BASE_URL}/payments/mock?payment_id={payment.id}",
        "payment_id": payment.id,
        "stripe": False,
    }


def mark_payment_succeeded(db: Session, payment_id: int, stripe_payment_intent_id: Optional[str] = None) -> Payment:
    p = db.query(Payment).get(payment_id)
    if not p:
        raise ValueError("payment not found")
    p.status = "succeeded"
    if stripe_payment_intent_id:
        p.stripe_payment_intent_id = stripe_payment_intent_id
    db.commit()
    db.refresh(p)
    _apply_payment_side_effects(db, p)
    return p


def _apply_payment_side_effects(db: Session, p: Payment):
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


def verify_webhook(payload: bytes, sig: str):
    if not (_stripe and STRIPE_WEBHOOK_SECRET):
        return None
    return _stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)


def is_stripe_configured() -> bool:
    return _stripe is not None
