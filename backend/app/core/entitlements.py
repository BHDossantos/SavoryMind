"""Tier-based feature entitlements for restaurants.

The audit's proposed pricing tiers (€99 / €249 / €499). Each tier unlocks
a superset of the previous tier's features. The `has_feature` helper is
the gate the frontend and route guards consult.

Stripe wiring deferred: each tier maps to a STRIPE_RESTAURANT_PRICE_ID_*
env var. When the operator hasn't created Prices yet, all paid users
fall back to "pro" (entitled to everything) so the pilot keeps working.

| Tier    | Includes                                                 |
| ------- | -------------------------------------------------------- |
| starter | bookings · booking link · menu broadcast · CRM · billing |
| growth  | + marketing campaigns · food waste · staff insights      |
|         |   · reports · review-response AI · weekly digest         |
| pro     | + inventory · advanced AI · multi-user                   |
"""
from __future__ import annotations

from ..models.user import User


TIER_STARTER = "starter"
TIER_GROWTH  = "growth"
TIER_PRO     = "pro"

# Order matters — higher index implies a superset.
TIER_RANK = {TIER_STARTER: 0, TIER_GROWTH: 1, TIER_PRO: 2}


# Feature → minimum tier required. Adding a new tier-gated feature is one
# line here; the frontend reads the same map via /entitlements.
FEATURE_MIN_TIER = {
    "bookings":          TIER_STARTER,
    "booking_link":      TIER_STARTER,
    "menu_broadcast":    TIER_STARTER,
    "crm":               TIER_STARTER,
    "billing":           TIER_STARTER,

    "marketing":         TIER_GROWTH,
    "campaigns":         TIER_GROWTH,
    "food_waste":        TIER_GROWTH,
    "staff_insights":    TIER_GROWTH,
    "reports":           TIER_GROWTH,
    "review_response":   TIER_GROWTH,
    "weekly_digest":     TIER_GROWTH,

    "inventory":         TIER_PRO,
    "advanced_ai":       TIER_PRO,
    "multi_user":        TIER_PRO,
    "predictions":       TIER_PRO,
}


def current_tier(user: User) -> str:
    """Return the operator's currently-entitled tier. Free users get
    starter-only access to the marketing screens; paying users without a
    tier explicitly set get pro so the pilot keeps working until tiered
    Stripe Prices are configured."""
    plan = (user.plan or "free").lower()
    if plan == "free":
        # Free users still get the booking link + CRM + menu broadcast —
        # that's the wedge that pulls them onto a paid tier. We just
        # don't unlock growth/pro features.
        return TIER_STARTER
    # Tier column (if set on the user) takes precedence over the legacy plan.
    tier = getattr(user, "restaurant_tier", None)
    if tier in TIER_RANK:
        return tier
    # Legacy entitlement: any active "pro" plan grants every feature.
    return TIER_PRO


def has_feature(user: User, feature: str) -> bool:
    needed = FEATURE_MIN_TIER.get(feature, TIER_STARTER)
    return TIER_RANK[current_tier(user)] >= TIER_RANK[needed]


def entitlements_for(user: User) -> dict:
    tier = current_tier(user)
    return {
        "tier": tier,
        "features": {f: has_feature(user, f) for f in FEATURE_MIN_TIER},
    }
