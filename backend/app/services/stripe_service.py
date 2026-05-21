"""Stripe billing integration for the consumer Premium subscription.

All Stripe access funnels through this module. The `stripe` SDK is imported
defensively: if the package isn't installed (e.g. a deploy that predates this
feature) the ImportError is swallowed and `is_configured()` returns False, so
the app still boots and billing endpoints respond 503 instead of 500.

Billing is "configured" only when the SDK is importable AND a secret key and a
recurring Price id are set. Until then the paywall still works — gated pages
show the upgrade screen — but the upgrade button reports billing isn't live.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from ..core.config import settings

logger = logging.getLogger(__name__)

try:
    import stripe as _stripe
except ImportError:  # SDK not installed — billing stays dormant.
    _stripe = None


def is_configured() -> bool:
    """True when Stripe can actually run a checkout: SDK present + keys set."""
    return bool(_stripe and settings.stripe_secret_key and settings.stripe_price_id)


def _client():
    if not is_configured():
        raise RuntimeError("Stripe is not configured.")
    _stripe.api_key = settings.stripe_secret_key
    return _stripe


def get_or_create_customer(user) -> str:
    """Return this user's Stripe customer id, creating one if needed.

    The caller is responsible for persisting a newly created id onto the
    user row so later webhook lookups by customer id resolve.
    """
    stripe = _client()
    if user.stripe_customer_id:
        return user.stripe_customer_id
    customer = stripe.Customer.create(
        email=user.email,
        metadata={"user_id": str(user.id)},
    )
    return customer.id


def create_checkout_session(user, customer_id: str) -> str:
    """Create a subscription Checkout Session, return its hosted URL."""
    stripe = _client()
    base = settings.frontend_url.rstrip("/")
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": settings.stripe_price_id, "quantity": 1}],
        success_url=f"{base}{settings.stripe_success_path}",
        cancel_url=f"{base}{settings.stripe_cancel_path}",
        client_reference_id=str(user.id),
        metadata={"user_id": str(user.id)},
        allow_promotion_codes=True,
    )
    return session.url


def create_portal_session(customer_id: str) -> str:
    """Create a billing-portal session so the user can manage / cancel."""
    stripe = _client()
    base = settings.frontend_url.rstrip("/")
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{base}/consumer/upgrade",
    )
    return session.url


def verify_webhook(payload: bytes, signature: str):
    """Verify + parse a webhook event. Raises ValueError on a bad signature."""
    stripe = _client()
    if not settings.stripe_webhook_secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET is not set.")
    try:
        return stripe.Webhook.construct_event(
            payload, signature, settings.stripe_webhook_secret
        )
    except Exception as e:
        # Includes both signature-verification failures and malformed payloads.
        raise ValueError(f"Invalid Stripe webhook: {e}")


def period_end_to_datetime(ts: Optional[int]) -> Optional[datetime]:
    """Convert a Stripe unix timestamp to a naive-UTC datetime (matching the
    other DateTime columns on the model). None / unparseable → None."""
    if not ts:
        return None
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).replace(tzinfo=None)
    except (TypeError, ValueError, OSError, OverflowError):
        return None
