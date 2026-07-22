"""Tomorrow forecasts (AI-OS Modules 4 & 11).

Two of the highest-value "what will happen tomorrow" predictions, both
computed from real history with honest confidence:

  reservations_forecast — tomorrow's expected reservations, covers,
    walk-ins, and revenue, from booking history for that weekday.
  inventory_forecast — per-SKU usage velocity from the adjustment ledger
    → days-until-stockout and a suggested reorder, so the owner sees
    "you'll run out of chicken in ~2 days" instead of a static par flag.

No recipes/BOM required — inventory uses the real usage rows already in
the append-only ledger. Confidence scales with how much history exists.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.restaurant_ext import Booking, SalesLog
from ..models.inventory import InventoryItem, InventoryAdjustment


# ── Reservations (M11) ───────────────────────────────────────────────────────

def reservations_forecast(db: Session, user_id: int) -> dict:
    tomorrow = date.today() + timedelta(days=1)
    dow = tomorrow.weekday()
    lookback = date.today() - timedelta(days=84)  # ~12 weeks

    # Same-weekday history, confirmed/seated only.
    rows = (db.query(Booking)
            .filter(Booking.user_id == user_id, Booking.date >= lookback,
                    Booking.status.in_(("confirmed", "seated", "pending")))
            .all())
    same_dow = [b for b in rows if b.date.weekday() == dow]
    if not same_dow:
        return {"date": str(tomorrow), "has_data": False,
                "predicted_reservations": None, "predicted_covers": None,
                "predicted_walk_ins": None, "expected_revenue": None,
                "confidence": "low", "basis": "Storico prenotazioni insufficiente."}

    # Group by date to get per-service-day averages.
    by_date: dict = {}
    for b in same_dow:
        d = by_date.setdefault(b.date, {"res": 0, "covers": 0})
        d["res"] += 1
        d["covers"] += b.party_size
    n_days = len(by_date)
    avg_res = sum(d["res"] for d in by_date.values()) / n_days
    avg_covers = sum(d["covers"] for d in by_date.values()) / n_days

    # Walk-in share: bookings not sourced online are effectively walk-ins/phone.
    walkin_share = (sum(1 for b in same_dow if b.source != "online") / len(same_dow))
    predicted_walk_ins = round(avg_covers * walkin_share * 0.5)  # conservative

    # Expected revenue = covers × average ticket (from sales history).
    avg_ticket = _avg_ticket(db, user_id)
    expected_revenue = round(avg_covers * avg_ticket, 2) if avg_ticket else None

    confidence = "high" if n_days >= 6 else "medium" if n_days >= 3 else "low"
    return {
        "date": str(tomorrow),
        "has_data": True,
        "predicted_reservations": round(avg_res),
        "predicted_covers": round(avg_covers),
        "predicted_walk_ins": predicted_walk_ins,
        "expected_revenue": expected_revenue,
        "confidence": confidence,
        "basis": f"Media di {n_days} {_dow_name(dow)} recenti.",
    }


def _avg_ticket(db: Session, user_id: int) -> float | None:
    since = date.today() - timedelta(days=30)
    rev, units = (db.query(func.coalesce(func.sum(SalesLog.revenue), 0.0),
                           func.coalesce(func.sum(SalesLog.quantity), 0))
                  .filter(SalesLog.user_id == user_id, SalesLog.sale_date >= since).first())
    if not units:
        return None
    return round(rev / units, 2)


_DOW_IT = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]


def _dow_name(dow: int) -> str:
    return _DOW_IT[dow] if 0 <= dow < 7 else "giorni"


# ── Inventory (M4) ───────────────────────────────────────────────────────────

def inventory_forecast(db: Session, user_id: int, horizon_days: int = 7) -> dict:
    items = (db.query(InventoryItem)
             .filter(InventoryItem.user_id == user_id, InventoryItem.archived_at.is_(None))
             .all())
    if not items:
        return {"has_data": False, "items": [], "reorder_soon": []}

    since = datetime.utcnow() - timedelta(days=28)
    forecasts = []
    for it in items:
        adjustments = (db.query(InventoryAdjustment)
                       .filter(InventoryAdjustment.item_id == it.id).all())
        on_hand = sum(a.delta for a in adjustments)
        # Usage velocity: average daily consumption over the window (usage+waste,
        # which are negative deltas). Positive number = units/day consumed.
        recent_use = sum(-a.delta for a in adjustments
                         if a.created_at and a.created_at >= since
                         and a.adjustment_type in ("usage", "waste") and a.delta < 0)
        daily_use = recent_use / 28.0
        days_left = round(on_hand / daily_use, 1) if daily_use > 0 else None
        needed = round(daily_use * horizon_days, 2)
        forecasts.append({
            "id": it.id, "name": it.name, "unit": it.unit,
            "on_hand": round(on_hand, 2),
            "daily_use": round(daily_use, 2),
            "days_until_stockout": days_left,
            "needed_next_7d": needed,
            "reorder_now": bool(days_left is not None and days_left <= 3)
                           or (it.par_level and on_hand < it.par_level),
        })

    reorder = sorted(
        [f for f in forecasts if f["reorder_now"]],
        key=lambda f: (f["days_until_stockout"] is None, f["days_until_stockout"] or 999),
    )
    return {"has_data": True, "items": forecasts, "reorder_soon": reorder}
