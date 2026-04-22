"""Trend alerts and marketing insights for restaurant owners."""
from sqlalchemy.orm import Session
from collections import Counter, defaultdict


def get_menu_trends(db: Session, restaurant_user_id: int) -> dict:
    """Surface trending menu insights based on orders, margins, and review sentiment."""
    from ..models.menu import MenuItem
    from ..models.review import Review

    items   = db.query(MenuItem).filter(MenuItem.user_id == restaurant_user_id).all()
    reviews = db.query(Review).filter(Review.user_id == restaurant_user_id).all()

    if not items:
        return _empty_trends()

    # Build sentiment map per dish
    sentiment_map: dict = defaultdict(lambda: {"pos": 0, "neg": 0, "total": 0})
    for r in reviews:
        s = sentiment_map[r.menu_item]
        s["total"] += 1
        if r.sentiment_label == "positive":
            s["pos"] += 1
        elif r.sentiment_label == "negative":
            s["neg"] += 1

    # Score each item
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

    # Rising stars: high sentiment growth + decent orders
    rising = [
        _item_card(x, "🚀 Rising star — loved by customers and selling well")
        for x in scored[:3]
        if x["pos_ratio"] >= 0.5 and x["item"].orders_last_30_days >= 5
    ]

    # Hidden gems: high margin + low orders → needs promotion
    gems = [
        _item_card(x, "💎 High margin, low traffic — promote this")
        for x in scored
        if x["margin"] >= 60 and (x["item"].orders_last_30_days or 0) < 20
    ][:3]

    # At risk: negative sentiment, still being ordered
    at_risk = [
        _item_card(x, "⚠️ Customers aren't happy — review quality or pricing")
        for x in scored
        if x["neg_ratio"] >= 0.4 and x["reviews"] >= 2
    ][:3]

    # Global food trend suggestions (static insight layer)
    global_trends = [
        {"trend": "🌱 Plant-forward dishes", "insight": "Vegetarian/vegan options are +34% in demand — consider a seasonal plant board."},
        {"trend": "🌶️ Korean & Southeast Asian flavours", "insight": "Gochujang, miso glazes, and bao buns are trending across all price points."},
        {"trend": "🍳 All-day brunch", "insight": "All-day breakfast menus drive 40% higher weekend covers."},
        {"trend": "🍹 Low & no alcohol", "insight": "Non-alcoholic cocktails now represent 18% of drinks orders — consider a mocktail list."},
        {"trend": "🫙 Fermented & preserved", "insight": "Kimchi, pickles, kombucha — fermented sides are a low-cost differentiator."},
    ]

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
    from ..models.restaurant_ext import CRMCustomer, RestaurantBooking

    customers = db.query(CRMCustomer).filter(CRMCustomer.user_id == restaurant_user_id).all()
    bookings  = db.query(RestaurantBooking).filter(RestaurantBooking.user_id == restaurant_user_id).all()

    total_customers = len(customers)
    vip_count       = sum(1 for c in customers if getattr(c, "is_vip", False))
    avg_spend       = (sum(getattr(c, "total_spend", 0) for c in customers) / total_customers) if total_customers else 0
    total_bookings  = len(bookings)
    confirmed_bk    = sum(1 for b in bookings if getattr(b, "status", "") == "confirmed")
    cancelled_bk    = sum(1 for b in bookings if getattr(b, "status", "") == "cancelled")

    retention_rate  = round(vip_count / total_customers * 100, 1) if total_customers else 0
    booking_rate    = round(confirmed_bk / total_bookings * 100, 1) if total_bookings else 0
    cancel_rate     = round(cancelled_bk / total_bookings * 100, 1) if total_bookings else 0

    # Actionable recommendations
    actions = []
    if retention_rate < 20:
        actions.append({
            "icon": "💌",
            "title": "Grow your VIP list",
            "detail": f"Only {retention_rate}% of guests are VIPs. Offer a loyalty card or birthday perk to regulars.",
            "priority": "high",
        })
    if cancel_rate > 20:
        actions.append({
            "icon": "📅",
            "title": "Reduce cancellations",
            "detail": f"{cancel_rate}% of bookings are cancelled. Add a confirmation SMS 24h before.",
            "priority": "high",
        })
    if avg_spend < 30:
        actions.append({
            "icon": "💰",
            "title": "Increase spend per head",
            "detail": f"Average spend is ${avg_spend:.0f}. Train staff to suggest starters, desserts, or cocktails.",
            "priority": "medium",
        })
    if total_customers < 20:
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

    return {
        "overview": {
            "total_guests":     total_customers,
            "vip_guests":       vip_count,
            "retention_rate":   f"{retention_rate}%",
            "avg_spend":        f"${avg_spend:.2f}",
            "total_bookings":   total_bookings,
            "booking_fill_rate":f"{booking_rate}%",
            "cancel_rate":      f"{cancel_rate}%",
        },
        "actions":   actions,
        "tips": [
            {"icon": "📲", "tip": "Post your standout dish on Instagram 3× a week — restaurants that do see a 22% lift in new covers."},
            {"icon": "🎂", "tip": "Birthday email campaigns have an 80% open rate. Collect birth months at sign-up."},
            {"icon": "🤝", "tip": "Partner with a nearby business (florist, cinema) for joint promotions. Low cost, high reach."},
        ],
    }


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
