"""Pilot instrumentation view (P3 §8.2).

A read-only funnel dashboard so Bruno can pull everything needed for a
case study without asking engineering — per-restaurant loss found,
recovered €, and engagement, aggregated from the real domain tables (no
generic event dump; these are true numbers).

Gated behind an ADMIN_EMAILS allowlist (comma-separated env var). Dormant
by default: with the var unset, the endpoint 403s for everyone, so it
never leaks pilot data until Bruno opts in.
"""
from __future__ import annotations

import os
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.loss import LossEstimate
from ...models.restaurant_ext import Incident, CoachingPlan
from ...services import coaching_service, loss_discovery_service

router = APIRouter(prefix="/admin", tags=["admin"])


def _admin_emails() -> set[str]:
    raw = os.getenv("ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    allow = _admin_emails()
    if not allow or (current_user.email or "").lower() not in allow:
        raise HTTPException(status_code=403, detail="Admin access required.")
    return current_user


@router.get("/pilots")
def pilots(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    """Per-restaurant pilot funnel. One row per restaurant account."""
    since = date.today() - timedelta(days=30)
    restaurants = db.query(User).filter(User.account_type == "restaurant").all()

    rows = []
    totals = {"restaurants": 0, "onboarded": 0, "with_estimate": 0,
              "guarantee_triggered": 0, "total_recovered": 0.0}
    for r in restaurants:
        latest = loss_discovery_service.latest(db, r.id)
        incidents_30d = (
            db.query(Incident)
            .filter(Incident.user_id == r.id, Incident.occurred_at >= since)
            .count()
        )
        active_plans = (
            db.query(CoachingPlan)
            .filter(CoachingPlan.user_id == r.id, CoachingPlan.status == "active")
            .count()
        )
        recovered = coaching_service.recovered_this_month(db, r.id)["recovered_this_month"]

        totals["restaurants"] += 1
        totals["onboarded"] += 1 if r.onboarding_completed else 0
        totals["with_estimate"] += 1 if latest else 0
        totals["guarantee_triggered"] += 1 if (latest and latest.guarantee_triggered) else 0
        totals["total_recovered"] += recovered

        rows.append({
            "id": r.id,
            "name": r.display_name,
            "city": r.city,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "onboarding_completed": bool(r.onboarding_completed),
            "plan": r.plan,
            "tier": getattr(r, "restaurant_tier", None),
            "loss_band": ([latest.total_monthly_loss_low, latest.total_monthly_loss_high]
                          if latest else None),
            "guarantee_triggered": bool(latest.guarantee_triggered) if latest else False,
            "incidents_30d": incidents_30d,
            "active_plans": active_plans,
            "recovered_this_month": recovered,
        })

    rows.sort(key=lambda x: (x["recovered_this_month"], x["incidents_30d"]), reverse=True)
    totals["total_recovered"] = round(totals["total_recovered"], 2)
    return {"totals": totals, "restaurants": rows}


@router.get("/leads")
def leads(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    """Captured calculator leads (marketing_leads), newest first — the output
    of the /calcolatore-spreco funnel, so Bruno can follow up. Read-only."""
    from ...models.marketing import MarketingLead
    since = datetime.utcnow() - timedelta(days=7)
    rows = (db.query(MarketingLead)
            .order_by(MarketingLead.created_at.desc())
            .limit(500).all())
    return {
        "total": db.query(MarketingLead).count(),
        "last_7d": db.query(MarketingLead).filter(MarketingLead.created_at >= since).count(),
        "leads": [{
            "id": l.id,
            "email": l.email,
            "restaurant_name": l.restaurant_name,
            "source": l.source,
            "profile": l.profile,
            "loss_band": [l.band_low, l.band_high],
            "created_at": l.created_at.isoformat() if l.created_at else None,
        } for l in rows],
    }
