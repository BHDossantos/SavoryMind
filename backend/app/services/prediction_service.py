import random
from datetime import datetime
from sqlalchemy.orm import Session
from ..models.menu import MenuItem
from ..schemas.restaurant_ext import SalesPrediction, PredictedItem
from .menu_service import _compute_revenue
from ..ml.analytics import get_demand_multipliers, get_sales_trends


def predict_sales(db: Session, user_id: int) -> SalesPrediction:
    now = datetime.now()
    hour = now.hour
    dow = now.weekday()
    end_hour = min(hour + 4, 23)

    items = db.query(MenuItem).filter(MenuItem.user_id == user_id).all()
    if not items:
        return SalesPrediction(
            window_label=f"Next 4 hours ({hour:02d}:00 – {end_hour:02d}:00)",
            day_label=_day_label(dow, hour),
            top_items=[],
            total_predicted_revenue=0,
            recommended_prep=[],
            staffing_note="No menu items to predict from.",
        )

    # Use real SalesLog multipliers when ≥20 log entries exist, else fall back
    day_mults, hour_mults = get_demand_multipliers(db, user_id)
    trends = get_sales_trends(db, user_id)

    day_mult = day_mults.get(dow, 1.0)
    window_hours = list(range(hour, end_hour + 1))
    hour_mults_window = [hour_mults.get(h, 0.5) for h in window_hours]
    window_mult = sum(hour_mults_window) / len(hour_mults_window)

    predicted = []
    for item in items:
        # If real velocity data exists for this item, weight it in
        real_velocity = trends["item_velocity"].get(item.name, 0) if trends["has_data"] else 0
        if real_velocity > 0 and trends.get("total_log_entries", 0) >= 20:
            # Use real daily velocity from logs
            days_of_data = max(1, trends["total_log_entries"] // max(1, len(items)))
            base_rate = real_velocity / days_of_data
            # Blend with menu estimate (70% real, 30% estimate)
            menu_rate = item.orders_last_30_days / 30
            base_rate = 0.7 * base_rate + 0.3 * menu_rate
            confidence = min(0.95, 0.70 + real_velocity / 500)
        else:
            base_rate = item.orders_last_30_days / 30
            confidence = min(0.95, 0.60 + item.orders_last_30_days / 500)

        jitter = random.uniform(0.90, 1.10)  # reduced noise when we have real data
        predicted_count = int(base_rate * day_mult * window_mult * jitter)
        predicted_count = max(0, predicted_count)
        revenue = round(predicted_count * item.price, 2)

        if window_mult > 1.2:
            trend = "rising"
        elif window_mult < 0.7:
            trend = "declining"
        else:
            trend = "stable"

        predicted.append(PredictedItem(
            name=item.name,
            category=item.category,
            predicted_orders=predicted_count,
            predicted_revenue=revenue,
            confidence=round(confidence, 2),
            trend=trend,
        ))

    predicted.sort(key=lambda p: p.predicted_orders, reverse=True)
    top = predicted[:8]
    total_revenue = round(sum(p.predicted_revenue for p in top), 2)

    prep = [
        f"Prep {int(p.predicted_orders * 1.15)} portions of {p.name}"
        for p in top[:4] if p.predicted_orders > 0
    ]
    staffing = _staffing_note(window_mult, day_mult, len(items))
    data_note = (
        f" (calibrated from {trends['total_log_entries']} real sales records)"
        if trends["has_data"] and trends.get("total_log_entries", 0) >= 20
        else " (using industry averages — add sales logs for personalised predictions)"
    )

    return SalesPrediction(
        window_label=f"Next 4 hours ({hour:02d}:00 – {end_hour:02d}:00)",
        day_label=_day_label(dow, hour) + data_note,
        top_items=top,
        total_predicted_revenue=total_revenue,
        recommended_prep=prep,
        staffing_note=staffing,
    )


def _day_label(dow: int, hour: int) -> str:
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    period = "morning" if hour < 12 else "lunch" if hour < 15 else "afternoon" if hour < 18 else "dinner"
    return f"{days[dow]} {period}"


def _staffing_note(window: float, day: float, item_count: int) -> str:
    combined = window * day
    if combined > 1.3:
        return "High demand window — ensure full floor and kitchen staff on duty."
    if combined > 1.0:
        return "Moderate demand — standard staffing sufficient."
    return "Low demand window — one floor staff and skeleton kitchen crew adequate."
