"""AI Command Center — the "Good morning" hero (AI-OS Module 1).

Assembles the owner's single-glance morning screen from signals that
already exist, so login opens on "Buongiorno — ieri hai incassato €X"
instead of a wall of reports. Pure assembly + light aggregation; every
number is real (yesterday's actuals from SalesLog/Booking) or clearly a
prediction (today's forecast from prediction_service).
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.menu import MenuItem
from ..models.restaurant_ext import SalesLog, Booking
from ..models.diner import DinerReview
from ..models.review import Review
from . import prediction_service, action_plan_service, inventory_service


def _yesterday_financials(db: Session, uid: int) -> dict:
    y = date.today() - timedelta(days=1)
    rows = (db.query(SalesLog.item_name, func.sum(SalesLog.quantity), func.sum(SalesLog.revenue))
            .filter(SalesLog.user_id == uid, SalesLog.sale_date == y)
            .group_by(SalesLog.item_name).all())
    if not rows:
        return {"revenue": None, "profit": None, "has_data": False}
    # Cost lookup by item name for a real gross-profit figure.
    costs = {m.name: (m.cost or 0.0) for m in db.query(MenuItem).filter(MenuItem.user_id == uid).all()}
    revenue = sum(r[2] or 0 for r in rows)
    cogs = sum((costs.get(r[0], 0.0)) * (r[1] or 0) for r in rows)
    return {"revenue": round(revenue, 2), "profit": round(revenue - cogs, 2), "has_data": True}


def _busy_hours(db: Session, uid: int) -> str | None:
    """Peak revenue window from the last 30 days of sales logs."""
    since = date.today() - timedelta(days=30)
    rows = (db.query(SalesLog.hour_of_day, func.sum(SalesLog.revenue))
            .filter(SalesLog.user_id == uid, SalesLog.sale_date >= since)
            .group_by(SalesLog.hour_of_day).all())
    if not rows:
        return None
    peak = max(rows, key=lambda r: r[1] or 0)[0]
    return f"{peak:02d}:00–{(peak + 2) % 24:02d}:00"


def _rating(db: Session, uid: int) -> float | None:
    avg = db.query(func.avg(DinerReview.rating)).filter(
        DinerReview.restaurant_user_id == uid).scalar()
    if avg is None:
        avg = db.query(func.avg(Review.rating)).filter(Review.user_id == uid).scalar()
    return round(float(avg), 1) if avg is not None else None


def build(db: Session, user) -> dict:
    uid = user.id
    fin = _yesterday_financials(db, uid)

    # Today's reservations (real).
    today = date.today()
    todays = db.query(Booking).filter(Booking.user_id == uid, Booking.date == today).all()
    reservations_today = sum(1 for b in todays if b.status in ("confirmed", "pending", "seated"))
    covers_today = sum(b.party_size for b in todays if b.status in ("confirmed", "seated"))

    # Predicted revenue for the upcoming window (clearly a forecast).
    try:
        pred = prediction_service.predict_sales(db, uid)
        predicted_revenue = getattr(pred, "total_predicted_revenue", None)
    except Exception:
        predicted_revenue = None

    # Alerts.
    try:
        low_stock = len(inventory_service.get_low_stock_items(db, uid))
    except Exception:
        low_stock = 0
    try:
        actions = action_plan_service.build_action_plan(db, user)
        rec_count = len(actions)
    except Exception:
        actions, rec_count = [], 0

    # Staff shortage signal from the workforce staffing suggestion, if any.
    staff_shortage = 0
    try:
        from . import workforce_intelligence_service
        wf = workforce_intelligence_service.build(db, uid)
        sug = (wf or {}).get("staffing_suggestion") or {}
        staff_shortage = max(0, int(sug.get("suggested_additional") or 0))
    except Exception:
        staff_shortage = 0

    hour = datetime.now().hour
    greeting = ("Buongiorno" if hour < 12 else "Buon pomeriggio" if hour < 18 else "Buonasera")

    return {
        "greeting": greeting,
        "restaurant_name": user.restaurant_name or user.display_name,
        "yesterday": {
            "revenue": fin["revenue"],
            "profit": fin["profit"],
            "has_data": fin["has_data"],
        },
        "rating": _rating(db, uid),
        "reservations_today": reservations_today,
        "covers_today": covers_today,
        "busy_hours": _busy_hours(db, uid),
        "predicted_revenue_today": predicted_revenue,
        "inventory_alerts": low_stock,
        "staff_shortages": staff_shortage,
        "recommendations": rec_count,
        "top_actions": actions[:3],
    }
