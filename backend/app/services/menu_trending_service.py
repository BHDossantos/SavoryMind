"""Restaurant "what's trending" — sales velocity & momentum.

The audit / user ask: give restaurant owners what's trending. This ranks
menu items by momentum — how fast their sales are accelerating — not just
raw volume. An item selling 20/week and climbing beats one selling 100/week
and flat, because momentum is what the owner should ride (promote, feature,
prep more).

Pure statistics over SalesLog (which POS sync now populates for real):
  recent   = units in the last `window` days
  prior    = units in the `window` days before that
  velocity = recent - prior           (absolute change)
  momentum = recent / max(prior, 1)   (growth multiple)
  trend    = rising | steady | falling

Interpretable, no training needed, and it gets sharper the more real data
flows in from the POS.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from ..models.restaurant_ext import SalesLog


def trending(db: Session, user_id: int, *, window_days: int = 7,
             today: date | None = None, limit: int = 10) -> dict[str, Any]:
    """Rank items by momentum over two adjacent `window_days` windows."""
    if today is None:
        today = date.today()
    recent_start = today - timedelta(days=window_days)
    prior_start = today - timedelta(days=window_days * 2)

    logs = (
        db.query(SalesLog)
        .filter(SalesLog.user_id == user_id, SalesLog.sale_date >= prior_start)
        .all()
    )

    recent: dict[str, int] = defaultdict(int)
    prior: dict[str, int] = defaultdict(int)
    recent_rev: dict[str, float] = defaultdict(float)
    for log in logs:
        if log.sale_date >= recent_start:
            recent[log.item_name] += log.quantity or 0
            recent_rev[log.item_name] += log.revenue or 0.0
        elif log.sale_date >= prior_start:
            prior[log.item_name] += log.quantity or 0

    rows: list[dict[str, Any]] = []
    names = set(recent) | set(prior)
    for name in names:
        r = recent.get(name, 0)
        p = prior.get(name, 0)
        velocity = r - p
        momentum = round(r / p, 2) if p > 0 else (float(r) if r else 0.0)
        if p == 0 and r > 0:
            trend = "new"
        elif r > p * 1.15:
            trend = "rising"
        elif r < p * 0.85:
            trend = "falling"
        else:
            trend = "steady"
        rows.append({
            "item": name,
            "recent_units": r,
            "prior_units": p,
            "velocity": velocity,
            "momentum": momentum,
            "recent_revenue": round(recent_rev.get(name, 0.0), 2),
            "trend": trend,
        })

    # Rank: rising/new first by velocity, then by momentum.
    trend_rank = {"rising": 0, "new": 1, "steady": 2, "falling": 3}
    rows.sort(key=lambda x: (trend_rank.get(x["trend"], 9), -x["velocity"], -x["momentum"]))

    rising = [r for r in rows if r["trend"] in ("rising", "new")][:limit]
    falling = [r for r in rows if r["trend"] == "falling"][:5]
    return {
        "window_days": window_days,
        "has_data": len(logs) > 0,
        "rising": rising,
        "falling": falling,
        "top": rows[:limit],
    }
