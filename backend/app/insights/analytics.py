"""
Restaurant analytics engine — uses real SalesLog data when available.

Functions here power the prediction endpoint and the reports page.
They fall back to menu-item averages when no SalesLog history exists
so the app is useful from day one.
"""
from collections import defaultdict
from sqlalchemy.orm import Session
from ..models.restaurant_ext import SalesLog, CRMCustomer
from ..models.menu import MenuItem
from ..models.review import Review


# ── Sales trend analysis ───────────────────────────────────────────────────────

def get_sales_trends(db: Session, user_id: int) -> dict:
    """
    Aggregate SalesLog into day-of-week and hour-of-day demand profiles.
    Returns normalised multipliers (1.0 = average).
    """
    logs = db.query(SalesLog).filter(SalesLog.user_id == user_id).all()
    if not logs:
        return {"has_data": False, "day_multipliers": {}, "hour_multipliers": {}, "item_velocity": {}}

    day_totals:  dict[int, float] = defaultdict(float)
    hour_totals: dict[int, float] = defaultdict(float)
    day_counts:  dict[int, int]   = defaultdict(int)
    hour_counts: dict[int, int]   = defaultdict(int)
    item_qty:    dict[str, int]   = defaultdict(int)

    for log in logs:
        day_totals[log.day_of_week]   += log.quantity
        hour_totals[log.hour_of_day]  += log.quantity
        day_counts[log.day_of_week]   += 1
        hour_counts[log.hour_of_day]  += 1
        item_qty[log.item_name]       += log.quantity

    # Normalise to multipliers relative to the mean
    def _normalise(totals: dict, counts: dict) -> dict:
        avgs = {k: totals[k] / counts[k] for k in totals}
        if not avgs:
            return {}
        mean = sum(avgs.values()) / len(avgs)
        return {k: round(v / mean, 3) for k, v in avgs.items()} if mean > 0 else avgs

    day_mults  = _normalise(day_totals, day_counts)
    hour_mults = _normalise(hour_totals, hour_counts)

    # Items ranked by total quantity sold
    item_velocity = dict(sorted(item_qty.items(), key=lambda x: x[1], reverse=True))

    return {
        "has_data": True,
        "day_multipliers":  day_mults,
        "hour_multipliers": hour_mults,
        "item_velocity":    item_velocity,
        "total_log_entries": len(logs),
    }


def get_demand_multipliers(db: Session, user_id: int) -> tuple[dict, dict]:
    """
    Return (day_mults, hour_mults) drawn from real SalesLog if available,
    otherwise return the hardcoded industry-average fallbacks.
    """
    _FALLBACK_DAY  = {0: 0.7, 1: 0.8, 2: 0.85, 3: 0.9, 4: 1.1, 5: 1.4, 6: 1.2}
    _FALLBACK_HOUR = {
        6: 0.1, 7: 0.2, 8: 0.4, 9: 0.5, 10: 0.5, 11: 0.7,
        12: 1.4, 13: 1.3, 14: 1.0, 15: 0.6, 16: 0.5, 17: 0.7,
        18: 1.0, 19: 1.5, 20: 1.4, 21: 1.2, 22: 0.8, 23: 0.4,
    }

    trends = get_sales_trends(db, user_id)
    if not trends["has_data"] or trends["total_log_entries"] < 20:
        return _FALLBACK_DAY, _FALLBACK_HOUR

    # Merge: prefer real data, fill gaps with fallback
    day_mults  = {**_FALLBACK_DAY,  **trends["day_multipliers"]}
    hour_mults = {**_FALLBACK_HOUR, **trends["hour_multipliers"]}
    return day_mults, hour_mults


# ── Item velocity (what's actually selling) ───────────────────────────────────

def get_item_performance(db: Session, user_id: int) -> list[dict]:
    """
    Rank menu items by real sales velocity from SalesLog.
    Returns items with real vs estimated order data annotated.
    """
    trends = get_sales_trends(db, user_id)
    items  = db.query(MenuItem).filter(MenuItem.user_id == user_id).all()

    result = []
    for item in items:
        real_qty = trends["item_velocity"].get(item.name, 0) if trends["has_data"] else 0
        margin   = round(((item.price - item.cost) / item.price) * 100, 1) if item.price > 0 else 0
        result.append({
            "name":           item.name,
            "category":       item.category,
            "price":          item.price,
            "margin_pct":     margin,
            "orders_30d":     item.orders_last_30_days,
            "real_qty_sold":  real_qty,
            "revenue_est":    round(item.price * item.orders_last_30_days, 2),
            "data_source":    "sales_log" if real_qty > 0 else "menu_estimate",
        })

    result.sort(key=lambda x: x["real_qty_sold"] or x["orders_30d"], reverse=True)
    return result


# ── CRM-driven customer insights ──────────────────────────────────────────────

def get_customer_insights(db: Session, user_id: int) -> dict:
    """
    Derive actionable insights from CRM data:
    - High-value customers at risk of churn (no recent visit)
    - Customers approaching a milestone visit
    - Average spend per visit trend
    """
    from datetime import date, timedelta

    customers = db.query(CRMCustomer).filter(CRMCustomer.user_id == user_id).all()
    if not customers:
        return {"at_risk": [], "milestones": [], "avg_spend": 0.0, "total_customers": 0}

    today = date.today()
    at_risk  = []
    milestones = []
    total_spend = 0.0
    total_visits = 0

    for c in customers:
        if c.total_spend and c.total_visits:
            total_spend  += c.total_spend
            total_visits += c.total_visits

        # At-risk: high spend, no visit in 60+ days
        if c.last_visit and c.total_spend > 200:
            days_since = (today - c.last_visit).days
            if days_since >= 60:
                at_risk.append({
                    "name": c.name,
                    "days_since_visit": days_since,
                    "total_spend": round(c.total_spend, 2),
                    "risk": "high" if days_since > 90 else "medium",
                })

        # Milestone: next visit would be a round number (5, 10, 25, 50, 100)
        if c.total_visits:
            milestones_targets = [5, 10, 25, 50, 100]
            for target in milestones_targets:
                if c.total_visits == target - 1:
                    milestones.append({
                        "name": c.name,
                        "next_visit_number": target,
                        "suggestion": f"Offer a complimentary dessert on visit #{target}",
                    })
                    break

    avg_spend = round(total_spend / total_visits, 2) if total_visits > 0 else 0.0

    return {
        "at_risk":         sorted(at_risk, key=lambda x: x["days_since_visit"], reverse=True)[:5],
        "milestones":      milestones[:5],
        "avg_spend":       avg_spend,
        "total_customers": len(customers),
    }


# ── Review sentiment trend ────────────────────────────────────────────────────

def get_sentiment_trend(db: Session, user_id: int) -> list[dict]:
    """
    Group reviews by month, return positive/neutral/negative counts.
    Used by the Reports page line chart.
    """
    reviews = db.query(Review).filter(Review.user_id == user_id).all()
    monthly: dict[str, dict] = defaultdict(lambda: {"positive": 0, "neutral": 0, "negative": 0, "total": 0})

    for r in reviews:
        if not r.created_at:
            continue
        key = r.created_at.strftime("%Y-%m")
        monthly[key]["total"] += 1
        score = getattr(r, "sentiment_score", None) or 0.0
        if score >= 0.05:
            monthly[key]["positive"] += 1
        elif score <= -0.05:
            monthly[key]["negative"] += 1
        else:
            monthly[key]["neutral"] += 1

    return [{"month": k, **v} for k, v in sorted(monthly.items())]


# ── Cross-platform signals ────────────────────────────────────────────────────

def get_cross_platform_signals(db: Session) -> dict:
    """
    Aggregate anonymised signals across all diner visits to surface
    trends that restaurants can act on (e.g. which dishes diners seek out).
    No user-identifiable data is returned.
    """
    from ..models.diner import DinerVisit

    visits = db.query(DinerVisit).all()
    if not visits:
        return {"top_sought_dishes": [], "avg_diner_rating": 0.0, "total_diner_visits": 0}

    item_counts: dict[str, int] = defaultdict(int)
    ratings: list[float] = []

    for v in visits:
        if v.items_ordered:
            for item in v.items_ordered.split(","):
                item = item.strip()
                if item:
                    item_counts[item] += 1
        ratings.append(v.overall_rating)

    top_dishes = sorted(item_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "top_sought_dishes": [{"dish": d, "count": c} for d, c in top_dishes],
        "avg_diner_rating":  round(sum(ratings) / len(ratings), 2) if ratings else 0.0,
        "total_diner_visits": len(visits),
    }
