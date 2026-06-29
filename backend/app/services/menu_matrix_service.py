"""Menu engineering matrix — classic Stars / Plowhorses / Puzzles / Dogs
quadrant based on item profit margin × popularity.

The audit asked for this directly: "Add item profitability matrix...
remove/keep/promote decision." Outputs item rows tagged with one of:

  star      — high margin · high popularity → feature prominently
  plowhorse — low margin  · high popularity → reprice or reduce cost
  puzzle    — high margin · low popularity  → promote or rename
  dog       — low margin  · low popularity  → remove
"""
from __future__ import annotations

from statistics import median
from typing import Any

from sqlalchemy.orm import Session

from ..models.menu import MenuItem


def _margin(price: float, cost: float) -> float:
    if not price or price <= 0:
        return 0.0
    return (price - cost) / price * 100.0


def build_matrix(db: Session, user_id: int) -> dict[str, Any]:
    items = db.query(MenuItem).filter(MenuItem.user_id == user_id).all()
    if not items:
        return {"items": [], "median_margin": 0, "median_orders": 0}

    margins = [_margin(i.price, i.cost) for i in items]
    orders  = [i.orders_last_30_days or 0 for i in items]
    med_m = median(margins)
    med_o = median(orders)

    rows = []
    for it in items:
        m = _margin(it.price, it.cost)
        o = it.orders_last_30_days or 0
        if   m >= med_m and o >= med_o: cat = "star"
        elif m <  med_m and o >= med_o: cat = "plowhorse"
        elif m >= med_m and o <  med_o: cat = "puzzle"
        else:                            cat = "dog"
        rows.append({
            "id":       it.id,
            "name":     it.name,
            "category": it.category,
            "price":    round(it.price or 0, 2),
            "cost":     round(it.cost  or 0, 2),
            "margin":   round(m, 1),
            "orders_last_30_days": o,
            "revenue":  round((it.price or 0) * o, 2),
            "matrix":   cat,
            "advice":   _advice(cat),
        })
    return {
        "items":          rows,
        "median_margin":  round(med_m, 1),
        "median_orders":  med_o,
    }


def _advice(cat: str) -> str:
    return {
        "star":      "Feature prominently — keep, promote, bundle.",
        "plowhorse": "High volume but thin margin — raise price 5–10% or cut cost.",
        "puzzle":    "Good margin, low orders — rename, reposition, or promote.",
        "dog":       "Low on both — strong candidate to remove.",
    }[cat]
