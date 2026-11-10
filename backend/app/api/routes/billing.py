"""Billing routes — consumer Premium subscription via Stripe.

Endpoints:
  GET  /api/billing/status   — current plan + subscription state
  POST /api/billing/checkout — start a Stripe Checkout session (returns url)
  POST /api/billing/portal   — open the Stripe billing portal (returns url)
  POST /api/billing/webhook  — Stripe → us; keeps `plan` in sync with Stripe

The webhook is the source of truth for entitlement: it flips `users.plan`
between "free" and "premium" as the subscription's status changes. Checkout
and portal are thin redirectors to Stripe-hosted pages.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ...core.config import settings
from ...core.database import get_db
from ...core.rate_limit import limiter
from ...core.security import get_current_user
from ...models.user import User
from ...services import stripe_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])

# Stripe subscription statuses that grant Premium access. past_due is
# intentionally excluded — Stripe retries payment and emits a fresh
# subscription.updated event when it resolves either way.
_PREMIUM_STATUSES = {"active", "trialing"}


def _is_premium(user: User) -> bool:
    return (user.plan or "free") == "premium"


def _has_active_subscription(user: User) -> bool:
    """True if the user already holds (or is trialing) a paid plan of EITHER
    tier. This snapshot guard does not serialize concurrent checkout requests;
    durable checkout reservations remain necessary for that guarantee."""
    return (user.plan or "free") in ("premium", "pro") or (
        user.subscription_status in _PREMIUM_STATUSES
    )


def _stripe_id(value):
    """Stripe references can be IDs or expanded objects."""
    return value if isinstance(value, str) else value.get("id") if hasattr(value, "get") else None


def _verified_plan(user: User, sub, subscription_id: str) -> str:
    if (not sub or not subscription_id or _stripe_id(sub) != subscription_id
            or _stripe_id(sub.get("customer")) != user.stripe_customer_id
            or not sub.get("status")):
        raise RuntimeError("Subscription identity could not be confirmed")
    consumer = settings.stripe_price_id
    restaurant = settings.stripe_restaurant_price_id
    expected = restaurant if user.account_type == "restaurant" else consumer
    if not expected or (consumer and consumer == restaurant):
        raise RuntimeError("Subscription product configuration is ambiguous")
    items = sub.get("items") or {}
    data = items.get("data")
    if not isinstance(data, list) or not data or items.get("has_more"):
        raise RuntimeError("Complete subscription items unavailable")
    # This application sells exactly one recurring price per subscription.
    # Unknown/add-on/multi-product shapes do not imply an entitlement.
    eligible = len(data) == 1 and data[0].get("quantity") == 1 and _stripe_id(data[0].get("price")) == expected
    if eligible and sub.get("status") in _PREMIUM_STATUSES:
        return "pro" if user.account_type == "restaurant" else "premium"
    return "free"


def _store_subscription(db, user, sub, sub_id, evt_ts=None):
    plan = _verified_plan(user, sub, sub_id)
    if plan == "free" and user.stripe_subscription_id and user.stripe_subscription_id != sub_id:
        # An unrelated subscription must not revoke a separately tracked plan.
        return
    if evt_ts is not None:
        user.stripe_event_ts = evt_ts
    user.stripe_subscription_id = sub_id
    user.subscription_status = sub.get("status")
    user.subscription_cancel_at_period_end = bool(sub.get("cancel_at_period_end", False))
    items = sub["items"]["data"]
    period_end = sub.get("current_period_end")
    if period_end is None and len(items) == 1:
        period_end = items[0].get("current_period_end")
    user.subscription_period_end = stripe_service.period_end_to_datetime(period_end)
    user.stripe_verified_plan = plan
    user.plan = plan
    from ...services.store_billing import apply_plan
    apply_plan(db, user)
    db.commit()


@router.get("/status")
def billing_status(current_user: User = Depends(get_current_user)):
    """Plan + subscription snapshot for the billing UI."""
    return {
        "plan": current_user.plan or "free",
        "is_premium": _is_premium(current_user),
        "subscription_status": current_user.subscription_status,
        "cancel_at_period_end": current_user.subscription_cancel_at_period_end,
        "can_cancel": bool(current_user.stripe_subscription_id and current_user.stripe_customer_id and stripe_service.cancellation_configured()),
        "current_period_end": (
            current_user.subscription_period_end.isoformat()
            if current_user.subscription_period_end else None
        ),
        "billing_configured": stripe_service.is_configured(),
        "trial_days": settings.stripe_trial_days,
    }


@router.get("/entitlements")
def billing_entitlements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Per-feature gating map the frontend consults before rendering a
    gated module. Same shape regardless of account type so a single
    helper can read it from the consumer + restaurant UIs. Per-account
    overrides (feature_overrides table) are layered on top of the tier
    defaults so a feature can be toggled without a deploy."""
    from ...core import entitlements
    overrides = entitlements.overrides_map(db, current_user.id)
    return entitlements.entitlements_for(current_user, overrides)


@router.post("/checkout")
@limiter.limit("10/minute")
def create_checkout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a Premium subscription checkout. Returns a Stripe-hosted URL."""
    if not stripe_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Billing isn't available yet. Please check back soon.",
        )
    # Account-type gate: a restaurant must subscribe via /restaurant/checkout
    # (its own Price). Without this a restaurant could buy the €9.99 consumer
    # Price yet be granted the full "pro" entitlement (account_type-keyed).
    if current_user.account_type == "restaurant":
        raise HTTPException(
            status_code=403,
            detail="Restaurants subscribe via the restaurant plan.",
        )
    if _has_active_subscription(current_user):
        raise HTTPException(
            status_code=409,
            detail="You already have an active subscription.",
        )
    try:
        customer_id = stripe_service.get_or_create_customer(current_user)
        # Persist the customer id immediately so the webhook can always
        # resolve this user by customer, even before checkout completes.
        if current_user.stripe_customer_id != customer_id:
            current_user.stripe_customer_id = customer_id
            db.commit()
        url = stripe_service.create_checkout_session(current_user, customer_id)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Stripe checkout session creation failed")
        raise HTTPException(
            status_code=502,
            detail="Could not start checkout. Please try again.",
        )
    return {"url": url}


@router.post("/cancel")
@limiter.limit("10/minute")
def cancel_subscription(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.stripe_subscription_id or not current_user.stripe_customer_id:
        raise HTTPException(status_code=409, detail="No existing billing subscription was found.")
    if not stripe_service.cancellation_configured():
        raise HTTPException(status_code=503, detail="Subscription management is temporarily unavailable. No cancellation has been confirmed.")
    try:
        result = stripe_service.cancel_at_period_end(current_user)
    except ValueError:
        raise HTTPException(status_code=409, detail="We could not verify this subscription's ownership. No cancellation has been confirmed.") from None
    except Exception:
        # Provider exceptions may contain credentials/customer data; do not echo.
        raise HTTPException(status_code=502, detail="The billing provider did not confirm cancellation. Please retry; no new purchase is needed.") from None
    current_user.subscription_cancel_at_period_end = result.get('cancel_at_period_end') is True
    if result.get('status') == 'canceled':
        current_user.subscription_status = 'canceled'
        current_user.stripe_verified_plan = 'free'
        current_user.plan = 'free'
        from ...services.store_billing import apply_plan
        apply_plan(db, current_user)
    db.commit()
    return {"confirmed": True, "cancel_at_period_end": current_user.subscription_cancel_at_period_end,
            "message": "Cancellation is scheduled for the end of the current billing period." if current_user.subscription_cancel_at_period_end else "Your subscription is cancelled."}


@router.post("/portal")
@limiter.limit("10/minute")
def create_portal(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Open the Stripe billing portal so the user can manage / cancel."""
    if not stripe_service.is_configured():
        raise HTTPException(status_code=503, detail="Billing isn't available yet.")
    if not current_user.stripe_customer_id:
        raise HTTPException(
            status_code=409,
            detail="No billing account found. Start a subscription first.",
        )
    try:
        url = stripe_service.create_portal_session(current_user.stripe_customer_id)
    except Exception:
        logger.exception("Stripe billing portal session creation failed")
        raise HTTPException(
            status_code=502,
            detail="Could not open the billing portal. Please try again.",
        )
    return {"url": url}


# ── Restaurant subscription (€99/mo) ─────────────────────────────────────────
# Separate Price + entitlement ("pro") from the consumer Premium plan, but the
# same Stripe customer/subscription columns and the same webhook. A restaurant
# is "pro" while its subscription is active/trialing.

def _is_pro(user: User) -> bool:
    return (user.plan or "free") == "pro"


def _require_restaurant(user: User) -> None:
    if user.account_type != "restaurant":
        raise HTTPException(status_code=403, detail="Restaurant accounts only.")


@router.get("/restaurant/status")
def restaurant_billing_status(current_user: User = Depends(get_current_user)):
    """Plan + subscription snapshot for the restaurant billing page."""
    _require_restaurant(current_user)
    return {
        "plan": current_user.plan or "free",
        "is_pro": _is_pro(current_user),
        "subscription_status": current_user.subscription_status,
        "cancel_at_period_end": current_user.subscription_cancel_at_period_end,
        "can_cancel": bool(current_user.stripe_subscription_id and current_user.stripe_customer_id and stripe_service.cancellation_configured()),
        "current_period_end": (
            current_user.subscription_period_end.isoformat()
            if current_user.subscription_period_end else None
        ),
        "billing_configured": stripe_service.is_restaurant_configured(),
        "trial_days": settings.stripe_restaurant_trial_days,
    }


@router.post("/restaurant/checkout")
@limiter.limit("10/minute")
def create_restaurant_checkout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start the restaurant €99/mo subscription. Returns a Stripe-hosted URL."""
    _require_restaurant(current_user)
    if not stripe_service.is_restaurant_configured():
        raise HTTPException(
            status_code=503,
            detail="Billing isn't available yet. Please check back soon.",
        )
    if _has_active_subscription(current_user):
        raise HTTPException(
            status_code=409,
            detail="You already have an active subscription.",
        )
    try:
        customer_id = stripe_service.get_or_create_customer(current_user)
        if current_user.stripe_customer_id != customer_id:
            current_user.stripe_customer_id = customer_id
            db.commit()
        url = stripe_service.create_restaurant_checkout_session(current_user, customer_id)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Stripe restaurant checkout session creation failed")
        raise HTTPException(
            status_code=502,
            detail="Could not start checkout. Please try again.",
        )
    return {"url": url}


@router.post("/restaurant/portal")
@limiter.limit("10/minute")
def create_restaurant_portal(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Open the Stripe billing portal for a restaurant to manage / cancel."""
    _require_restaurant(current_user)
    if not current_user.stripe_customer_id:
        raise HTTPException(
            status_code=409,
            detail="No billing account found. Start a subscription first.",
        )
    try:
        url = stripe_service.create_portal_session(
            current_user.stripe_customer_id, return_path="/restaurant/billing"
        )
    except Exception:
        logger.exception("Stripe restaurant portal session creation failed")
        raise HTTPException(
            status_code=502,
            detail="Could not open the billing portal. Please try again.",
        )
    return {"url": url}


def _find_user(db: Session, customer_id, user_id) -> User | None:
    # Checkout persists this binding before creating a hosted session. Metadata
    # is only a cross-check; it must never claim or rebind another customer.
    customer_id = _stripe_id(customer_id)
    if not customer_id:
        raise RuntimeError("Missing customer binding")
    user = db.query(User).filter(User.stripe_customer_id == customer_id).one_or_none()
    if user_id is not None and (not user or str(user.id) != str(user_id)):
        raise RuntimeError("Customer and user reference disagree")
    return user


def _event_is_stale(user: User, evt_ts) -> bool:
    """True when this event is older than the last one we applied for this user
    — Stripe can deliver (and replay) events out of order, so ignoring older
    ones stops a stale `subscription.updated(active)` from resurrecting a plan
    that a later `subscription.deleted` already cancelled."""
    return (
        evt_ts is not None
        and user.stripe_event_ts is not None
        and evt_ts < user.stripe_event_ts
    )


def _apply_event(db: Session, event) -> None:
    """Mutate the affected user's entitlement from a verified Stripe event."""
    etype = event["type"]
    obj = event["data"]["object"]
    evt_ts = event.get("created")  # Stripe unix seconds (always set in prod)

    if etype == "checkout.session.completed":
        user_id = obj.get("client_reference_id") or (obj.get("metadata") or {}).get("user_id")
        user = _find_user(db, obj.get("customer"), user_id)
        if not user:
            logger.warning("checkout.session.completed for unknown user")
            return
        # Both checkout identity references must agree if supplied.
        metadata_id = (obj.get("metadata") or {}).get("user_id")
        if metadata_id is not None and str(metadata_id) != str(user.id):
            raise RuntimeError("Checkout metadata identity disagrees")
        sub_id = _stripe_id(obj.get("subscription"))
        if _event_is_stale(user, evt_ts):
            return
        sub = stripe_service.retrieve_subscription(sub_id)
        _store_subscription(db, user, sub, sub_id, evt_ts)

    elif etype in ("customer.subscription.created", "customer.subscription.updated"):
        user = _find_user(db, obj.get("customer"), None)
        if not user:
            return
        sub_id = _stripe_id(obj.get("id"))
        # Signed events can arrive out of order; validate a current provider
        # snapshot rather than granting from the event's historical status.
        if _event_is_stale(user, evt_ts):
            return
        sub = stripe_service.retrieve_subscription(sub_id)
        _store_subscription(db, user, sub, sub_id, evt_ts)

    elif etype == "customer.subscription.deleted":
        user = _find_user(db, obj.get("customer"), None)
        if not user:
            return
        if not obj.get("id") or obj.get("id") != user.stripe_subscription_id:
            # A late deletion of an older subscription must not revoke the
            # separately recorded replacement subscription.
            return
        if _event_is_stale(user, evt_ts):
            return
        if evt_ts is not None:
            user.stripe_event_ts = evt_ts
        user.subscription_status = "canceled"
        user.subscription_cancel_at_period_end = False
        user.stripe_verified_plan = "free"
        user.plan = "free"
        from ...services.store_billing import apply_plan
        apply_plan(db, user)
        db.commit()


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Receive subscription lifecycle events from Stripe.

    The raw body is signature-verified against STRIPE_WEBHOOK_SECRET — an
    unverified or malformed event is rejected 400 and never touches the DB.

    Accepts events when *either* product (consumer Premium or restaurant)
    is configured — one webhook serves both; the per-user entitlement is
    checked against the bound customer and configured account-specific price.
    """
    if not (stripe_service.is_configured() or stripe_service.is_restaurant_configured()):
        raise HTTPException(status_code=503, detail="Billing is not configured.")
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    try:
        event = stripe_service.verify_webhook(payload, signature)
    except (ValueError, RuntimeError):
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")
    try:
        _apply_event(db, event)
    except Exception:
        db.rollback()
        # No durable queue accepted this event. A 2xx would lose it on provider
        # or database failure; return a retryable response without private data.
        logger.warning("Stripe webhook processing failed; redelivery required")
        raise HTTPException(status_code=503, detail="Billing update could not be confirmed. Retry delivery.") from None
    return {"received": True}
