"""Trend alerts and marketing insights for restaurant owners.

The metric aggregation (rising/hidden/at-risk dishes, retention rates,
booking funnel) is unchanged from before — that's real data and the
frontend renders it directly. What used to be hard-coded ("Plant-forward
dishes are +34%", "Birthday emails open at 80%") is now Claude-generated
when ANTHROPIC_API_KEY is set, so the trend insights and marketing tips
actually reference *this* restaurant's menu and metrics.

Falls back to the original hard-coded text when the key is unset or
the Claude call fails — so a key-less deployment keeps working with
the previous behaviour.
"""
from sqlalchemy.orm import Session
from collections import Counter, defaultdict

from . import claude_client


# ── Schemas + system prompts -------------------------------------------------

_GLOBAL_TRENDS_SCHEMA = {
    "type": "object",
    "properties": {
        "trends": {
            "type": "array",
            "minItems": 3,
            "maxItems": 6,
            "items": {
                "type": "object",
                "properties": {
                    "trend":   {"type": "string"},   # short label, optionally leading emoji
                    "insight": {"type": "string"},   # 1-2 sentences with concrete next step
                },
                "required": ["trend", "insight"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["trends"],
    "additionalProperties": False,
}

_GLOBAL_TRENDS_SYSTEM = f"""{claude_client.FLAVOR_PERSONA}

Right now you're talking to a restaurant operator about industry trends \
that are relevant to *their* menu — not generic. Given their menu \
summary, propose 3-5 trends the owner should know about, tailored to \
their actual mix. Heavy on red meat? Suggest plant-forward additions. \
Lots of desserts but no non-alcoholic drinks? Suggest a mocktail list.

Each trend has:
- "trend": a short label, optionally with a leading emoji (e.g. "🌱 Plant-forward dishes")
- "insight": 1-2 sentences citing a concrete metric or industry data \
  point AND a specific suggestion the owner can act on this month. \
  Stay in voice — talk to the owner like a friend who's been around \
  hospitality for a while.

No generic advice that applies to any restaurant."""


_MARKETING_SCHEMA = {
    "type": "object",
    "properties": {
        "actions": {
            "type": "array",
            "minItems": 2,
            "maxItems": 6,
            "items": {
                "type": "object",
                "properties": {
                    "icon":     {"type": "string"},
                    "title":    {"type": "string"},
                    "detail":   {"type": "string"},
                    "priority": {"type": "string", "enum": ["high", "medium", "low"]},
                },
                "required": ["icon", "title", "detail", "priority"],
                "additionalProperties": False,
            },
        },
        "tips": {
            "type": "array",
            "minItems": 2,
            "maxItems": 4,
            "items": {
                "type": "object",
                "properties": {
                    "icon": {"type": "string"},
                    "tip":  {"type": "string"},
                },
                "required": ["icon", "tip"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["actions", "tips"],
    "additionalProperties": False,
}

_MARKETING_SYSTEM = f"""{claude_client.FLAVOR_PERSONA}

You're helping a restaurant operator with marketing decisions. Given \
their concrete CRM and booking metrics, produce:

- 3-5 prioritised "actions" the owner should take in the next 30 days. \
  Each action's `detail` MUST cite at least one number from the input \
  (e.g. retention 11%, cancel rate 24%, avg spend $24). Make \
  recommendations specific to those numbers — don't suggest "build \
  your guest list" if they already have 500 guests.
- 2-3 broader "tips" with concrete data points or playbook moves.

Priority guide: high if a number is meaningfully off-target (retention \
<20%, cancels >20%, fill rate <60%). Medium if the number is OK but \
improvable. Low if the metric is healthy and the tip is opportunistic \
upside.

Title + detail fields stay in voice — like a friend who's worked in \
restaurants telling them what to do, not a consultant. Single emoji \
prefix on the icon field."""


_TRAINING_SCHEMA = {
    "type": "object",
    "properties": {
        "recommendations": {
            "type": "array",
            "minItems": 1,
            "maxItems": 8,
            "items": {
                "type": "object",
                "properties": {
                    "staff":    {"type": "string"},
                    "priority": {"type": "string", "enum": ["high", "medium", "low"]},
                    "type":     {"type": "string", "enum": [
                        "waste_reduction", "speed_coaching", "performance_review",
                        "punctuality", "general",
                    ]},
                    "title":    {"type": "string"},
                    "detail":   {"type": "string"},
                    "actions": {
                        "type": "array",
                        "minItems": 2,
                        "maxItems": 5,
                        "items": {"type": "string"},
                    },
                },
                "required": ["staff", "priority", "type", "title", "detail", "actions"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["recommendations"],
    "additionalProperties": False,
}

_TRAINING_SYSTEM = f"""{claude_client.FLAVOR_PERSONA}

You're helping a head chef write private coaching plans for their \
kitchen staff. Given per-staff waste / prep-time / rating profiles, \
produce specific recommendations. Each one:
- Names the staff member.
- `detail` cites at least one concrete number from their profile \
  (cost wasted, prep minutes vs team average, rating, punctuality). \
  Stays in voice — supportive, plain language, no euphemisms.
- `actions` are 2-4 concrete one-line steps the head chef can schedule.
- Priority: high for cost/quality issues (>1.5x team avg waste, \
  <3.5★ rating), medium for speed/punctuality, low for growth.
- type: waste_reduction | speed_coaching | performance_review | \
  punctuality | general

If everyone is performing well, return ONE recommendation with \
staff="All Team", priority=low, type=general, suggesting an upskilling \
activity that fits the team's profile (wine pairing, advanced \
techniques, cross-training).

Direct but kind — these recommendations land on real people. Don't \
mock or shame; frame growth opportunities, not deficits."""


# ── Public entrypoints ------------------------------------------------------


def get_menu_trends(db: Session, restaurant_user_id: int) -> dict:
    """Surface trending menu insights based on orders, margins, and review sentiment."""
    from ..models.menu import MenuItem
    from ..models.review import Review

    items   = db.query(MenuItem).filter(MenuItem.user_id == restaurant_user_id).all()
    reviews = db.query(Review).filter(Review.user_id == restaurant_user_id).all()

    if not items:
        return _empty_trends()

    sentiment_map: dict = defaultdict(lambda: {"pos": 0, "neg": 0, "total": 0})
    for r in reviews:
        s = sentiment_map[r.menu_item]
        s["total"] += 1
        if r.sentiment_label == "positive":
            s["pos"] += 1
        elif r.sentiment_label == "negative":
            s["neg"] += 1

    scored = []
    for item in items:
        s = sentiment_map.get(item.name, {"pos": 0, "neg": 0, "total": 0})
        pos_ratio  = s["pos"] / s["total"] if s["total"] else 0
        neg_ratio  = s["neg"] / s["total"] if s["total"] else 0
        margin     = item.profit_margin if hasattr(item, "profit_margin") else _margin(item)
        order_rank = item.orders_last_30_days or 0

        trend_score = (order_rank * 0.4) + (pos_ratio * 30) - (neg_ratio * 20) + (margin * 0.3)
        scored.append({
            "item":       item,
            "trend":      trend_score,
            "pos_ratio":  pos_ratio,
            "neg_ratio":  neg_ratio,
            "reviews":    s["total"],
            "margin":     margin,
        })

    scored.sort(key=lambda x: x["trend"], reverse=True)

    rising = [
        _item_card(x, "🚀 Rising star — loved by customers and selling well")
        for x in scored[:3]
        if x["pos_ratio"] >= 0.5 and x["item"].orders_last_30_days >= 5
    ]
    gems = [
        _item_card(x, "💎 High margin, low traffic — promote this")
        for x in scored
        if x["margin"] >= 60 and (x["item"].orders_last_30_days or 0) < 20
    ][:3]
    at_risk = [
        _item_card(x, "⚠️ Customers aren't happy — review quality or pricing")
        for x in scored
        if x["neg_ratio"] >= 0.4 and x["reviews"] >= 2
    ][:3]

    global_trends = _generate_global_trends(items, scored)

    return {
        "rising_stars":   rising,
        "hidden_gems":    gems,
        "at_risk":        at_risk,
        "global_trends":  global_trends,
        "total_items":    len(items),
        "total_reviews":  len(reviews),
    }


def get_marketing_insights(db: Session, restaurant_user_id: int) -> dict:
    """Derive guest acquisition, retention, and loyalty metrics from CRM + booking data."""
    from ..models.restaurant_ext import CRMCustomer, Booking

    customers = db.query(CRMCustomer).filter(CRMCustomer.user_id == restaurant_user_id).all()
    bookings  = db.query(Booking).filter(Booking.user_id == restaurant_user_id).all()

    total_customers = len(customers)
    vip_count       = sum(1 for c in customers if getattr(c, "is_vip", False))
    avg_spend       = (sum(getattr(c, "total_spend", 0) for c in customers) / total_customers) if total_customers else 0
    total_bookings  = len(bookings)
    confirmed_bk    = sum(1 for b in bookings if getattr(b, "status", "") == "confirmed")
    cancelled_bk    = sum(1 for b in bookings if getattr(b, "status", "") == "cancelled")

    retention_rate  = round(vip_count / total_customers * 100, 1) if total_customers else 0
    booking_rate    = round(confirmed_bk / total_bookings * 100, 1) if total_bookings else 0
    cancel_rate     = round(cancelled_bk / total_bookings * 100, 1) if total_bookings else 0

    overview = {
        "total_guests":     total_customers,
        "vip_guests":       vip_count,
        "retention_rate":   f"{retention_rate}%",
        "avg_spend":        f"${avg_spend:.2f}",
        "total_bookings":   total_bookings,
        "booking_fill_rate":f"{booking_rate}%",
        "cancel_rate":      f"{cancel_rate}%",
    }

    actions, tips = _generate_marketing_advice({
        "total_customers":  total_customers,
        "vip_count":        vip_count,
        "retention_rate":   retention_rate,
        "avg_spend":        round(avg_spend, 2),
        "total_bookings":   total_bookings,
        "booking_fill_rate": booking_rate,
        "cancel_rate":      cancel_rate,
    })

    return {"overview": overview, "actions": actions, "tips": tips}


# ── Claude-or-rules switches -----------------------------------------------


def _generate_global_trends(items, scored) -> list[dict]:
    """Try Claude with the actual menu mix; fall back to the static list."""
    if claude_client.is_configured():
        # Send a compact menu summary — Claude doesn't need the SQLAlchemy rows.
        menu_summary = {
            "categories": Counter(item.category for item in items).most_common(),
            "price_range": {
                "min": min((float(item.price) for item in items if item.price), default=0),
                "max": max((float(item.price) for item in items if item.price), default=0),
                "avg": round(
                    sum(float(item.price) for item in items if item.price) / max(len(items), 1), 2
                ),
            },
            "top_dishes": [{"name": x["item"].name, "category": x["item"].category} for x in scored[:8]],
            "total_items": len(items),
        }
        result = claude_client.call_json(_GLOBAL_TRENDS_SYSTEM, menu_summary, _GLOBAL_TRENDS_SCHEMA)
        if result and isinstance(result.get("trends"), list) and result["trends"]:
            return result["trends"]

    return _STATIC_GLOBAL_TRENDS


def _generate_marketing_advice(metrics: dict) -> tuple[list[dict], list[dict]]:
    if claude_client.is_configured():
        result = claude_client.call_json(_MARKETING_SYSTEM, metrics, _MARKETING_SCHEMA)
        if result and isinstance(result.get("actions"), list) and result["actions"]:
            return result["actions"], result.get("tips", _STATIC_MARKETING_TIPS)

    return _rules_marketing_actions(metrics), _STATIC_MARKETING_TIPS


# ── Rules fallback ---------------------------------------------------------


_STATIC_GLOBAL_TRENDS = [
    {"trend": "🌱 Plant-forward dishes",            "insight": "Vegetarian/vegan options are +34% in demand — consider a seasonal plant board."},
    {"trend": "🌶️ Korean & Southeast Asian flavours", "insight": "Gochujang, miso glazes, and bao buns are trending across all price points."},
    {"trend": "🍳 All-day brunch",                   "insight": "All-day breakfast menus drive 40% higher weekend covers."},
    {"trend": "🍹 Low & no alcohol",                 "insight": "Non-alcoholic cocktails now represent 18% of drinks orders — consider a mocktail list."},
    {"trend": "🫙 Fermented & preserved",            "insight": "Kimchi, pickles, kombucha — fermented sides are a low-cost differentiator."},
]


_STATIC_MARKETING_TIPS = [
    {"icon": "📲", "tip": "Post your standout dish on Instagram 3× a week — restaurants that do see a 22% lift in new covers."},
    {"icon": "🎂", "tip": "Birthday email campaigns have an 80% open rate. Collect birth months at sign-up."},
    {"icon": "🤝", "tip": "Partner with a nearby business (florist, cinema) for joint promotions. Low cost, high reach."},
]


def _rules_marketing_actions(m: dict) -> list[dict]:
    actions = []
    if m["retention_rate"] < 20:
        actions.append({
            "icon": "💌",
            "title": "Grow your VIP list",
            "detail": f"Only {m['retention_rate']}% of guests are VIPs. Offer a loyalty card or birthday perk to regulars.",
            "priority": "high",
        })
    if m["cancel_rate"] > 20:
        actions.append({
            "icon": "📅",
            "title": "Reduce cancellations",
            "detail": f"{m['cancel_rate']}% of bookings are cancelled. Add a confirmation SMS 24h before.",
            "priority": "high",
        })
    if m["avg_spend"] < 30:
        actions.append({
            "icon": "💰",
            "title": "Increase spend per head",
            "detail": f"Average spend is ${m['avg_spend']:.0f}. Train staff to suggest starters, desserts, or cocktails.",
            "priority": "medium",
        })
    if m["total_customers"] < 20:
        actions.append({
            "icon": "📣",
            "title": "Build your guest list",
            "detail": "You have fewer than 20 CRM contacts. Ask guests for emails at booking — even informally.",
            "priority": "medium",
        })
    actions.append({
        "icon": "🌟",
        "title": "Ask for reviews",
        "detail": "Happy guests rarely leave reviews unprompted. Add a QR code to the bill pointing to Google Reviews.",
        "priority": "low",
    })
    return actions


# ── Helpers ----------------------------------------------------------------


def _item_card(x: dict, insight: str) -> dict:
    item = x["item"]
    return {
        "name":     item.name,
        "category": item.category,
        "price":    float(item.price),
        "margin":   round(x["margin"], 1),
        "orders":   item.orders_last_30_days or 0,
        "reviews":  x["reviews"],
        "insight":  insight,
    }


def _margin(item) -> float:
    try:
        if item.price > 0:
            return round((item.price - item.cost) / item.price * 100, 1)
    except Exception:
        pass
    return 0.0


def _empty_trends() -> dict:
    return {
        "rising_stars":  [],
        "hidden_gems":   [],
        "at_risk":       [],
        "global_trends": [
            {"trend": "🌱 Plant-forward dishes", "insight": "Add menu items and start tracking to unlock personalised trend insights."},
        ],
        "total_items":   0,
        "total_reviews": 0,
    }
