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
    """True when Stripe can actually run a consumer checkout: SDK present + keys set."""
    return bool(_stripe and settings.stripe_secret_key and settings.stripe_price_id)


def is_restaurant_configured() -> bool:
    """True when Stripe can run the restaurant €99/mo checkout: SDK present,
    secret key set, and a restaurant Price id configured. Independent of the
    consumer Price so one product can ship before the other."""
    return bool(_stripe and settings.stripe_secret_key and settings.stripe_restaurant_price_id)


def _client():
    if not is_configured():
        raise RuntimeError("Stripe is not configured.")
    _stripe.api_key = settings.stripe_secret_key
    return _stripe


def _restaurant_client():
    """Like _client() but gated on the restaurant Price being configured.
    Lets the restaurant flow ship even if the consumer Price is unset."""
    if not is_restaurant_configured():
        raise RuntimeError("Restaurant billing is not configured.")
    _stripe.api_key = settings.stripe_secret_key
    return _stripe


def get_or_create_customer(user) -> str:
    """Return this user's Stripe customer id, creating one if needed.

    The caller is responsible for persisting a newly created id onto the
    user row so later webhook lookups by customer id resolve.

    Customer creation only needs the secret key (not a Price), so this works
    when *either* the consumer or restaurant product is configured.
    """
    if is_configured():
        stripe = _client()
    elif is_restaurant_configured():
        stripe = _restaurant_client()
    else:
        raise RuntimeError("Stripe is not configured.")
    if user.stripe_customer_id:
        return user.stripe_customer_id
    customer = stripe.Customer.create(
        email=user.email,
        metadata={"user_id": str(user.id)},
    )
    return customer.id


def create_checkout_session(user, customer_id: str) -> str:
    """Create a subscription Checkout Session, return its hosted URL.

    When stripe_trial_days > 0 the subscription starts in a free trial: the
    card is collected now, the first charge is deferred. Trial subscriptions
    arrive with status "trialing", which the webhook treats as Premium.
    """
    stripe = _client()
    base = settings.frontend_url.rstrip("/")
    params = dict(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": settings.stripe_price_id, "quantity": 1}],
        success_url=f"{base}{settings.stripe_success_path}",
        cancel_url=f"{base}{settings.stripe_cancel_path}",
        client_reference_id=str(user.id),
        metadata={"user_id": str(user.id)},
        allow_promotion_codes=True,
    )
    if settings.stripe_trial_days > 0:
        params["subscription_data"] = {"trial_period_days": settings.stripe_trial_days}
    session = stripe.checkout.Session.create(**params)
    return session.url


def create_restaurant_checkout_session(user, customer_id: str) -> str:
    """Create the restaurant €99/mo subscription Checkout Session, return URL.

    Mirrors create_checkout_session but uses the restaurant Price + restaurant
    return paths, and adds a plan=restaurant metadata tag so the webhook can
    set the right entitlement without re-reading account_type (defense in
    depth — the webhook also checks account_type)."""
    stripe = _restaurant_client()
    base = settings.frontend_url.rstrip("/")
    params = dict(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": settings.stripe_restaurant_price_id, "quantity": 1}],
        success_url=f"{base}{settings.stripe_restaurant_success_path}",
        cancel_url=f"{base}{settings.stripe_restaurant_cancel_path}",
        client_reference_id=str(user.id),
        metadata={"user_id": str(user.id), "plan": "restaurant"},
        allow_promotion_codes=True,
    )
    if settings.stripe_restaurant_trial_days > 0:
        params["subscription_data"] = {
            "trial_period_days": settings.stripe_restaurant_trial_days
        }
    session = stripe.checkout.Session.create(**params)
    return session.url


def retrieve_subscription(subscription_id: str):
    """Fetch a Stripe Subscription object, or None if it can't be retrieved."""
    if not subscription_id:
        return None
    try:
        stripe = _client() if is_configured() else _restaurant_client()
        return stripe.Subscription.retrieve(subscription_id)
    except Exception:
        logger.exception("Failed to retrieve Stripe subscription %s", subscription_id)
        return None


def create_portal_session(customer_id: str, return_path: str = "/consumer/upgrade") -> str:
    """Create a billing-portal session so the user can manage / cancel.

    return_path defaults to the consumer upgrade page; restaurant callers
    pass "/restaurant/billing". The portal itself works for any customer
    regardless of which Price they're subscribed to, so this only needs
    one of the two Stripe configs to be live."""
    # Use whichever client is configured — the portal is product-agnostic.
    stripe = _client() if is_configured() else _restaurant_client()
    base = settings.frontend_url.rstrip("/")
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{base}{return_path}",
    )
    return session.url


def verify_webhook(payload: bytes, signature: str):
    """Verify + parse a webhook event. Raises ValueError on a bad signature.

    Works when either product is configured — the same webhook secret signs
    events for both the consumer and restaurant plans."""
    stripe = _client() if is_configured() else _restaurant_client()
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
