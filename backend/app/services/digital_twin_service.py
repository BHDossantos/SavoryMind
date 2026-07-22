"""Digital Twin — the unified per-restaurant snapshot (AI-OS Module 18).

The leap from "management system" to "AI operating system": instead of
dashboards, one call answers the five questions an owner actually has —

  1. What happened yesterday?      (real actuals)
  2. Why did it happen?            (data-derived drivers vs the weekday norm)
  3. What will happen tomorrow?    (reservations + sales forecast)
  4. What should I do today?       (action plan, each with € impact)
  5. How healthy is the business?  (health score)

Everything is fused from services that already compute these pieces, so
the Twin is an honest synthesis — no new guesses, every € traceable. A
Claude "why" narrative is layered on when configured; otherwise a
deterministic, number-driven explanation is used.
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.menu import MenuItem
from ..models.restaurant_ext import SalesLog
from ..models.kitchen import FoodWasteLog
from . import (command_center_service, forecasting_service, health_score_service,
               action_plan_service, prediction_service, claude_client)


def _weekday_revenue_baseline(db: Session, uid: int, target: date) -> float | None:
    """Average revenue on the same weekday over the prior ~8 weeks."""
    dow = target.weekday()
    lookback = target - timedelta(days=63)
    rows = (db.query(SalesLog.sale_date, func.sum(SalesLog.revenue))
            .filter(SalesLog.user_id == uid, SalesLog.sale_date >= lookback,
                    SalesLog.sale_date < target)
            .group_by(SalesLog.sale_date).all())
    same = [r[1] or 0 for r in rows if r[0].weekday() == dow]
    if not same:
        return None
    return sum(same) / len(same)


def _why_drivers(db: Session, uid: int, y: date, revenue: float | None,
                 baseline: float | None) -> list[str]:
    """Data-derived reasons yesterday landed where it did."""
    drivers = []
    if revenue is not None and baseline:
        delta = revenue - baseline
        pct = (delta / baseline * 100) if baseline else 0
        word = "sopra" if delta >= 0 else "sotto"
        drivers.append(f"Incasso {word} la media del giorno ({pct:+.0f}% vs tipico €{baseline:.0f}).")

    # Top contributing items yesterday.
    rows = (db.query(SalesLog.item_name, func.sum(SalesLog.quantity), func.sum(SalesLog.revenue))
            .filter(SalesLog.user_id == uid, SalesLog.sale_date == y)
            .group_by(SalesLog.item_name)
            .order_by(func.sum(SalesLog.revenue).desc()).limit(3).all())
    if rows:
        top = ", ".join(f"{r[0]} ({int(r[1] or 0)}×)" for r in rows)
        drivers.append(f"Piatti che hanno trainato: {top}.")

    # Waste drag yesterday.
    waste = (db.query(func.coalesce(func.sum(FoodWasteLog.estimated_cost), 0.0))
             .filter(FoodWasteLog.user_id == uid, FoodWasteLog.date == y).scalar() or 0.0)
    if waste > 0:
        drivers.append(f"Sprechi registrati: €{waste:.0f}.")
    return drivers


def _claude_why(restaurant_name: str, drivers: list[str]) -> str | None:
    """Optional one-paragraph narrative. Uses ONLY the given drivers —
    never invents numbers. Falls back to None when Claude is unconfigured."""
    schema = {"type": "object", "properties": {"narrative": {"type": "string"}},
              "required": ["narrative"], "additionalProperties": False}
    prompt = (f"{claude_client.FLAVOR_PERSONA}\n\nYou are the restaurant's AI analyst. "
              "Given these factual drivers, write ONE short paragraph in Italian explaining "
              "why yesterday went the way it did. Use ONLY these facts and their numbers — "
              "invent nothing. Warm, plain, owner-to-owner.")
    out = claude_client.call_json(prompt, {"restaurant": restaurant_name, "drivers": drivers},
                                  schema, max_tokens=350, cache_system=False)
    return out.get("narrative") if out else None


def snapshot(db: Session, user) -> dict:
    uid = user.id
    y = date.today() - timedelta(days=1)

    cc = command_center_service.build(db, user)
    yest = cc["yesterday"]
    baseline = _weekday_revenue_baseline(db, uid, y)
    drivers = _why_drivers(db, uid, y, yest.get("revenue"), baseline)
    why_narrative = _claude_why(cc["restaurant_name"], drivers) if drivers else None

    # Tomorrow.
    res_fc = forecasting_service.reservations_forecast(db, uid)
    try:
        pred = prediction_service.predict_sales(db, uid)
        sales_fc_rev = getattr(pred, "total_predicted_revenue", None)
    except Exception:
        sales_fc_rev = None

    # Today's actions (each already carries € impact + a CTA).
    try:
        actions = action_plan_service.build_action_plan(db, user)
    except Exception:
        actions = []
    action_value = sum((a.get("estimated_gain") or 0) for a in actions)

    health = health_score_service.health_score(db, uid)

    # Headline synthesis.
    if yest.get("has_data") and yest.get("revenue") is not None:
        vs = ""
        if baseline:
            pct = (yest["revenue"] - baseline) / baseline * 100
            vs = f" ({pct:+.0f}% vs tipico)"
        headline = f"Ieri €{yest['revenue']:.0f}{vs}."
    else:
        headline = "Non ci sono ancora dati di vendita di ieri."
    if actions:
        headline += f" Oggi: {len(actions)} azioni" + (
            f" per ~€{action_value:.0f}." if action_value else ".")

    return {
        "headline": headline,
        "restaurant_name": cc["restaurant_name"],
        "what_happened": {
            "revenue": yest.get("revenue"),
            "profit": yest.get("profit"),
            "has_data": yest.get("has_data"),
            "weekday_baseline": round(baseline, 2) if baseline else None,
        },
        "why": {"drivers": drivers, "narrative": why_narrative},
        "tomorrow": {
            "reservations": res_fc,
            "predicted_sales_revenue": sales_fc_rev,
        },
        "today_actions": actions[:5],
        "today_action_value": round(action_value, 2),
        "health": {"overall": health["overall"], "band": health["band"]},
    }
