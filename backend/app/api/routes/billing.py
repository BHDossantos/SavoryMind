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


def _entitled_plan(user: User) -> str:
    """The plan value an active subscription grants this user. Restaurants
    get "pro" (the €99/mo plan); everyone else gets "premium". Keyed on
    account_type so one webhook handles both products."""
    return "pro" if user.account_type == "restaurant" else "premium"


@router.get("/status")
def billing_status(current_user: User = Depends(get_current_user)):
    """Plan + subscription snapshot for the billing UI."""
    return {
        "plan": current_user.plan or "free",
        "is_premium": _is_premium(current_user),
        "subscription_status": current_user.subscription_status,
        "current_period_end": (
            current_user.subscription_period_end.isoformat()
            if current_user.subscription_period_end else None
        ),
        "billing_configured": stripe_service.is_configured(),
        "trial_days": settings.stripe_trial_days,
    }


@router.get("/entitlements")
def billing_entitlements(current_user: User = Depends(get_current_user)):
    """Per-feature gating map the frontend consults before rendering a
    gated module. Same shape regardless of account type so a single
    helper can read it from the consumer + restaurant UIs."""
    from ...core import entitlements
    return entitlements.entitlements_for(current_user)


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
    if _is_premium(current_user):
        raise HTTPException(
            status_code=409,
            detail="You already have an active Premium subscription.",
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
    if _is_pro(current_user):
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
    """Resolve the webhook event's user — by Stripe customer id first
    (set at checkout time), falling back to our own user_id metadata."""
    user = None
    if customer_id:
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if not user and user_id:
        try:
            user = db.query(User).filter(User.id == int(user_id)).first()
        except (TypeError, ValueError):
            user = None
    return user


def _apply_event(db: Session, event) -> None:
    """Mutate the affected user's entitlement from a verified Stripe event."""
    etype = event["type"]
    obj = event["data"]["object"]

    if etype == "checkout.session.completed":
        user_id = obj.get("client_reference_id") or (obj.get("metadata") or {}).get("user_id")
        user = _find_user(db, obj.get("customer"), user_id)
        if not user:
            logger.warning("checkout.session.completed for unknown user")
            return
        user.stripe_customer_id = obj.get("customer") or user.stripe_customer_id
        sub_id = obj.get("subscription")
        user.stripe_subscription_id = sub_id or user.stripe_subscription_id
        # Retrieve the subscription so trial vs. active status is accurate
        # immediately, rather than depending on the customer.subscription.*
        # event arriving first.
        sub = stripe_service.retrieve_subscription(sub_id)
        if sub is not None:
            status = sub.get("status")
            user.subscription_status = status
            user.subscription_period_end = stripe_service.period_end_to_datetime(
                sub.get("current_period_end")
            )
            user.plan = _entitled_plan(user) if status in _PREMIUM_STATUSES else "free"
        else:
            # Couldn't fetch — checkout succeeded, so grant access; the
            # follow-up subscription event will correct status/period.
            user.plan = _entitled_plan(user)
            user.subscription_status = user.subscription_status or "active"
        db.commit()

    elif etype in ("customer.subscription.created", "customer.subscription.updated"):
        user = _find_user(db, obj.get("customer"), None)
        if not user:
            return
        status = obj.get("status")
        user.stripe_subscription_id = obj.get("id") or user.stripe_subscription_id
        user.subscription_status = status
        user.subscription_period_end = stripe_service.period_end_to_datetime(
            obj.get("current_period_end")
        )
        user.plan = _entitled_plan(user) if status in _PREMIUM_STATUSES else "free"
        db.commit()

    elif etype == "customer.subscription.deleted":
        user = _find_user(db, obj.get("customer"), None)
        if not user:
            return
        user.subscription_status = "canceled"
        user.plan = "free"
        db.commit()


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Receive subscription lifecycle events from Stripe.

    The raw body is signature-verified against STRIPE_WEBHOOK_SECRET — an
    unverified or malformed event is rejected 400 and never touches the DB.

    Accepts events when *either* product (consumer Premium or restaurant)
    is configured — one webhook serves both; the per-user entitlement is
    chosen by account_type in _apply_event.
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
        # Don't 500 — Stripe would retry indefinitely. Log for triage.
        logger.exception("Failed to apply Stripe webhook event")
    return {"received": True}
