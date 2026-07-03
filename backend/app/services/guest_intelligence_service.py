"""Guest Intelligence — the AI CRM layer.

The audit's North Star for CRM: don't say "John visited." Say "John hasn't
visited in 41 days · 83% likely to return · send a 15% steak offer · [Send]".

This module turns the rows in `crm_customers` into:
  - auto-segments (VIP, new, inactive, high-spender, birthday-this-month, …)
  - per-guest churn / return probability with an at-risk flag
  - a customer interaction timeline (bookings + visits + reviews)
  - a one-click AI win-back offer (drafted by campaign_service, sent via SMS)

All computed on read from data we already store — no new write path, no
background job. The numbers are heuristic and labeled as estimates in the
UI; they're directional signals to drive an action, not a data-science
claim.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Optional

from sqlalchemy.orm import Session

from ..models.restaurant_ext import Booking, CRMCustomer
from ..models.review import Review


# --- Segments ---------------------------------------------------------------

INACTIVE_DAYS = 45           # no visit in this many days → "inactive"
NEW_DAYS = 30                # created within this many days → "new"
VIP_MIN_SPEND = 500.0        # lifetime spend at/above this → "high spender"
FREQUENT_MIN_VISITS = 8      # this many visits → "frequent"


def _days_since(d: Optional[date], today: date) -> Optional[int]:
    if not d:
        return None
    return (today - d).days


def segments_for(c: CRMCustomer, today: date) -> list[str]:
    """Return the segment tags a single customer belongs to right now."""
    out: list[str] = []
    tags = (c.tags or "").lower()
    if "vip" in tags or (c.loyalty_tier or "").lower() == "vip":
        out.append("vip")
    if (c.total_spend or 0) >= VIP_MIN_SPEND:
        out.append("high_spender")
    if (c.total_visits or 0) >= FREQUENT_MIN_VISITS:
        out.append("frequent")
    created = c.created_at.date() if isinstance(c.created_at, datetime) else c.created_at
    if created and _days_since(created, today) is not None and _days_since(created, today) <= NEW_DAYS \
            and (c.total_visits or 0) <= 1:
        out.append("new")
    dsl = _days_since(c.last_visit, today)
    if dsl is not None and dsl >= INACTIVE_DAYS:
        out.append("inactive")
    if c.birthday and c.birthday.month == today.month:
        out.append("birthday_this_month")
    if c.anniversary and c.anniversary.month == today.month:
        out.append("anniversary_this_month")
    if (c.wine_pref or "").strip() or "wine" in (c.favorite_drinks or "").lower():
        out.append("wine_lover")
    if (c.allergies or "").strip():
        out.append("dietary")
    return out


def segment_summary(db: Session, user_id: int, today: date | None = None) -> dict[str, int]:
    """Counts per segment across the restaurant's whole book — drives the
    segment chips on the CRM page."""
    if today is None:
        today = date.today()
    customers = db.query(CRMCustomer).filter(CRMCustomer.user_id == user_id).all()
    counts: dict[str, int] = {}
    for c in customers:
        for s in segments_for(c, today):
            counts[s] = counts.get(s, 0) + 1
    counts["all"] = len(customers)
    return counts


# --- Churn / return prediction ---------------------------------------------

def return_probability(c: CRMCustomer, today: date | None = None) -> float:
    """Heuristic probability (0..1) the guest returns in the next ~30 days.

    Intuition: a guest who comes every 7 days and last came 5 days ago is
    almost certain to return; one who came once 200 days ago is nearly lost.
    We estimate the guest's personal cadence from visits-over-tenure, then
    decay against how many cadence-cycles have elapsed since the last visit.
    """
    if today is None:
        today = date.today()
    visits = c.total_visits or 0
    dsl = _days_since(c.last_visit, today)
    if visits <= 0 or dsl is None:
        return 0.25  # unknown — mild baseline
    created = c.created_at.date() if isinstance(c.created_at, datetime) else c.created_at
    tenure = max(_days_since(created, today) or 30, 30)
    # Average gap between visits, floored so a 1-visit guest doesn't look daily.
    cadence = max(tenure / max(visits, 1), 7.0)
    cycles = dsl / cadence
    # Exponential decay: at 1 cycle ≈ 0.74, 2 cycles ≈ 0.55, 3 ≈ 0.41.
    import math
    p = math.exp(-0.30 * cycles)
    # Loyalty / spend nudge — high-value guests are stickier.
    if (c.total_spend or 0) >= VIP_MIN_SPEND:
        p = min(1.0, p + 0.1)
    return round(max(0.02, min(0.98, p)), 2)


def at_risk_guests(db: Session, user_id: int, *, today: date | None = None,
                   limit: int = 20) -> list[dict[str, Any]]:
    """Guests worth a win-back nudge today: previously engaged (≥2 visits)
    but now overdue. Ranked by lifetime value × lapse so the operator's
    effort goes where the money is."""
    if today is None:
        today = date.today()
    customers = (
        db.query(CRMCustomer)
        .filter(CRMCustomer.user_id == user_id)
        .all()
    )
    rows: list[dict[str, Any]] = []
    for c in customers:
        dsl = _days_since(c.last_visit, today)
        if (c.total_visits or 0) < 2 or dsl is None:
            continue
        if dsl < INACTIVE_DAYS:
            continue
        prob = return_probability(c, today)
        rows.append({
            "id":               c.id,
            "name":             c.name,
            "phone":            c.phone,
            "email":            c.email,
            "days_since_visit": dsl,
            "total_visits":     c.total_visits or 0,
            "total_spend":      round(c.total_spend or 0, 2),
            "return_probability": prob,
            "favorite_dishes":  c.favorite_dishes or c.favorite_items or "",
            # Priority = value at stake × recoverability. We want guests who
            # are both valuable AND still plausibly winnable, not lost causes.
            "_priority":        (c.total_spend or 0) * prob,
        })
    rows.sort(key=lambda r: r["_priority"], reverse=True)
    for r in rows:
        r.pop("_priority", None)
    return rows[:limit]


# --- Timeline ---------------------------------------------------------------

def timeline_for(db: Session, user_id: int, customer_id: int,
                 *, limit: int = 50) -> list[dict[str, Any]]:
    """Unified interaction timeline for a single guest, newest first.
    Stitches together bookings (by phone/email match) + the CRM row's own
    visit/spend markers + reviews under the same name."""
    c = (
        db.query(CRMCustomer)
        .filter(CRMCustomer.id == customer_id, CRMCustomer.user_id == user_id)
        .first()
    )
    if not c:
        return []

    events: list[dict[str, Any]] = []

    # Bookings matched by phone or email.
    bq = db.query(Booking).filter(Booking.user_id == user_id)
    conds = []
    if c.phone:
        conds.append(Booking.customer_phone == c.phone)
    if c.email:
        conds.append(Booking.customer_email == c.email)
    if conds:
        from sqlalchemy import or_
        for b in bq.filter(or_(*conds)).all():
            events.append({
                "type": "booking",
                "date": str(b.date),
                "label": f"Booked · party of {b.party_size} · {b.status}",
                "icon": "📅",
            })

    # Reviews under the same name (best-effort).
    if c.name:
        for r in db.query(Review).filter(
            Review.user_id == user_id, Review.customer_name == c.name,
        ).all():
            events.append({
                "type": "review",
                "date": str(r.created_at.date() if isinstance(r.created_at, datetime) else r.created_at),
                "label": f"Reviewed {r.menu_item} · {r.rating}★",
                "icon": "⭐",
            })

    # CRM-level markers.
    if c.last_visit:
        events.append({"type": "visit", "date": str(c.last_visit),
                       "label": f"Last visit · ${c.total_spend or 0:.0f} lifetime", "icon": "🍽"})
    created = c.created_at.date() if isinstance(c.created_at, datetime) else c.created_at
    if created:
        events.append({"type": "created", "date": str(created),
                       "label": "Added to CRM", "icon": "✨"})

    events.sort(key=lambda e: e["date"], reverse=True)
    return events[:limit]
