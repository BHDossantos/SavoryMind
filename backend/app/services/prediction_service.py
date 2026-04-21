import random
from datetime import datetime
from sqlalchemy.orm import Session
from ..models.menu import MenuItem
from ..schemas.restaurant_ext import SalesPrediction, PredictedItem
from .menu_service import _compute_revenue

# Day-of-week multipliers (0=Mon, 6=Sun)
DAY_MULTIPLIERS = {0: 0.7, 1: 0.8, 2: 0.85, 3: 0.9, 4: 1.1, 5: 1.4, 6: 1.2}

# Hour-of-day multipliers for a typical restaurant
HOUR_MULTIPLIERS = {
    6: 0.1, 7: 0.2, 8: 0.4, 9: 0.5, 10: 0.5, 11: 0.7,
    12: 1.4, 13: 1.3, 14: 1.0, 15: 0.6, 16: 0.5, 17: 0.7,
    18: 1.0, 19: 1.5, 20: 1.4, 21: 1.2, 22: 0.8, 23: 0.4,
}


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

    day_mult = DAY_MULTIPLIERS.get(dow, 1.0)
    hour_mults = [HOUR_MULTIPLIERS.get(h, 0.5) for h in range(hour, end_hour + 1)]
    window_mult = sum(hour_mults) / len(hour_mults)

    predicted = []
    for item in items:
        base_rate = item.orders_last_30_days / 30          # avg orders per day
        predicted_count = int(base_rate * day_mult * window_mult * random.uniform(0.85, 1.15))
        predicted_count = max(0, predicted_count)
        revenue = round(predicted_count * item.price, 2)

        # Trend: compare window_mult to baseline (1.0)
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
            confidence=round(min(0.95, 0.6 + item.orders_last_30_days / 500), 2),
            trend=trend,
        ))

    predicted.sort(key=lambda p: p.predicted_orders, reverse=True)
    top = predicted[:8]
    total_revenue = round(sum(p.predicted_revenue for p in top), 2)

    prep = [f"Prep {int(p.predicted_orders * 1.15)} portions of {p.name}" for p in top[:4] if p.predicted_orders > 0]
    staffing = _staffing_note(window_mult, day_mult, len(items))

    return SalesPrediction(
        window_label=f"Next 4 hours ({hour:02d}:00 – {end_hour:02d}:00)",
        day_label=_day_label(dow, hour),
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
