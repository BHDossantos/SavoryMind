"""Wrapper around Stripe with a stub mode for keyless dev/CI.

In stub mode (no STRIPE_SECRET_KEY), checkout sessions point at a frontend
success URL directly and refunds are recorded in the DB only. This lets the
booking flow be exercised end-to-end without real Stripe credentials.
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Optional

import stripe

from .config import settings


def is_stub_mode() -> bool:
    return not settings.stripe_secret_key


@dataclass
class CheckoutSession:
    id: str
    url: str
    payment_intent_id: Optional[str] = None


@dataclass
class RefundResult:
    id: str
    amount_cents: int


def _ensure_stripe_configured() -> None:
    stripe.api_key = settings.stripe_secret_key


def create_checkout_session(
    *,
    appointment_id: int,
    payment_id: int,
    amount_cents: int,
    currency: str,
    description: str,
    customer_email: str,
) -> CheckoutSession:
    if is_stub_mode():
        token = secrets.token_urlsafe(16)
        url = (
            f"{settings.frontend_url}/booking/success?stub=1"
            f"&session_id=stub_{token}&payment_id={payment_id}"
        )
        return CheckoutSession(id=f"stub_{token}", url=url, payment_intent_id=f"pi_stub_{token}")

    _ensure_stripe_configured()
    session = stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": currency.lower(),
                    "product_data": {"name": description},
                    "unit_amount": amount_cents,
                },
                "quantity": 1,
            }
        ],
        customer_email=customer_email,
        metadata={"appointment_id": str(appointment_id), "payment_id": str(payment_id)},
        success_url=(
            f"{settings.frontend_url}/booking/success?session_id={{CHECKOUT_SESSION_ID}}"
        ),
        cancel_url=f"{settings.frontend_url}/appointments?checkout=cancelled",
    )
    return CheckoutSession(id=session.id, url=session.url, payment_intent_id=session.payment_intent)


def refund_payment_intent(payment_intent_id: str, amount_cents: int) -> RefundResult:
    if is_stub_mode() or payment_intent_id.startswith("pi_stub_"):
        return RefundResult(id=f"re_stub_{secrets.token_urlsafe(8)}", amount_cents=amount_cents)
    _ensure_stripe_configured()
    refund = stripe.Refund.create(payment_intent=payment_intent_id, amount=amount_cents)
    return RefundResult(id=refund.id, amount_cents=refund.amount)


def verify_webhook(payload: bytes, signature: str) -> dict:
    """Verify a Stripe webhook signature. Returns the event dict."""
    if is_stub_mode():
        # In stub mode, accept the JSON body as-is for local testing.
        import json
        return json.loads(payload)
    _ensure_stripe_configured()
    event = stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
    return event
