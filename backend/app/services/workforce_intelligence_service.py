"""Workforce Intelligence — the AI layer over staff data.

Wave B of the Restaurant OS. Like guest_intelligence turned the CRM into
actions, this turns the staff roster into the audit's North Star cards:

  "Sarah is likely to quit (87%) — reduced hours, low tips, 3 conflicts.
   Recommend +6 hrs/week + a 1:1."

  "Saturday is expected 28% busier — add 2 servers, 1 cook. Approve?"

  "Mike is at 46 hrs — overtime begins tomorrow. Move Wed shift to John?"

All heuristic, computed on read from the Staff rows + sales rhythm we
already store. No new write path. Numbers are directional signals to
drive a one-click action, labeled as estimates in the UI.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from ..models.restaurant_ext import Staff
from . import prediction_service


# Weekly hours threshold beyond which the next scheduled shift tips into
# overtime (US/EU common 40h baseline; restaurants watch this closely).
OVERTIME_THRESHOLD_HRS = 40
# Below this rating/punctuality, performance is a coaching signal not a
# crisis — kept conservative so the panel doesn't cry wolf.
LOW_RATING = 3.5
LOW_PUNCTUALITY = 80.0


def _attrition_risk(s: Staff) -> dict[str, Any] | None:
    """Estimate flight risk for one staffer from the signals we have:
    low/declining rating, poor punctuality, thin order flow (proxy for
    reduced hours / low tips). Returns None when there's no real signal —
    we never invent a risk to fill the panel."""
    reasons: list[str] = []
    score = 0.0

    rating = s.rating if s.rating is not None else 4.0
    punct = s.punctuality_score if s.punctuality_score is not None else 100.0
    orders = s.orders_handled or 0

    if rating < LOW_RATING:
        score += 0.35
        reasons.append(f"rating {rating:.1f}/5")
    if punct < LOW_PUNCTUALITY:
        score += 0.30
        reasons.append(f"punctuality {punct:.0f}%")
    if orders < 20:
        score += 0.25
        reasons.append("low shift volume")
    # Tenure: brand-new hires churn more; long-tenured with low signals
    # churn from burnout. We only have hire_date, so flag very recent hires.
    if s.hire_date:
        tenure_days = (date.today() - s.hire_date).days
        if 0 <= tenure_days <= 60 and rating < 4.0:
            score += 0.15
            reasons.append("new hire, shaky start")

    if score < 0.4 or not reasons:
        return None
    confidence = min(0.95, round(score, 2))
    return {
        "id": s.id,
        "name": s.name,
        "role": s.role,
        "confidence": confidence,
        "reasons": reasons,
        "recommendation": _attrition_reco(reasons),
    }


def _attrition_reco(reasons: list[str]) -> str:
    if any("volume" in r or "hours" in r for r in reasons):
        return "Increase hours and schedule a 1:1 this week."
    if any("punctuality" in r for r in reasons):
        return "Check in on scheduling conflicts; a 1:1 may surface a fixable issue."
    return "Schedule a 1:1 — small interventions retain good people cheaply."


def _estimate_weekly_hours(s: Staff) -> int:
    """We don't track a time clock yet, so estimate weekly hours from the
    shift band. Conservative midpoints; replaced by real clock data in a
    later wave."""
    return {
        "full": 45, "evening": 30, "afternoon": 25, "morning": 25,
    }.get((s.shift or "").lower(), 30)


def build(db: Session, user_id: int) -> dict[str, Any]:
    """Compose the workforce intelligence payload: overtime alerts,
    attrition risks, and a demand-based staffing suggestion for the next
    busy window."""
    staff = db.query(Staff).filter(Staff.user_id == user_id, Staff.active == True).all()  # noqa: E712

    # Overtime: anyone whose estimated weekly hours is at/over threshold.
    overtime = []
    for s in staff:
        hrs = _estimate_weekly_hours(s)
        if hrs >= OVERTIME_THRESHOLD_HRS:
            overtime.append({
                "id": s.id, "name": s.name, "role": s.role,
                "estimated_weekly_hours": hrs,
                "over_by": hrs - OVERTIME_THRESHOLD_HRS,
                "recommendation": "Redistribute the next shift to a teammate under 40h.",
            })
    overtime.sort(key=lambda x: x["estimated_weekly_hours"], reverse=True)

    # Attrition.
    attrition = [r for r in (_attrition_risk(s) for s in staff) if r]
    attrition.sort(key=lambda x: x["confidence"], reverse=True)

    # Demand-based staffing for the next predicted window, reusing the
    # existing sales forecaster's window multiplier.
    staffing = _staffing_suggestion(db, user_id, staff)

    return {
        "overtime_alerts": overtime,
        "attrition_risks": attrition,
        "staffing_suggestion": staffing,
    }


def _staffing_suggestion(db: Session, user_id: int, staff: list[Staff]) -> dict[str, Any] | None:
    """Turn the sales forecast's busyness multiplier into a concrete
    add/keep staffing call for the upcoming window."""
    try:
        pred = prediction_service.predict_sales(db, user_id)
    except Exception:
        return None
    note = getattr(pred, "staffing_note", "") or ""
    label = getattr(pred, "window_label", "the next window")
    # Derive a coarse "busier/quieter" delta from the staffing note text the
    # forecaster already produces (it bakes the window multiplier in).
    busier = "busy" in note.lower() or "add" in note.lower() or "peak" in note.lower()
    quieter = "quiet" in note.lower() or "slow" in note.lower() or "reduce" in note.lower()
    on_shift = len(staff)
    if busier:
        add_servers = max(1, on_shift // 4)
        return {
            "window": label,
            "direction": "up",
            "headline": f"{label}: expected busier than usual",
            "recommendation": f"Add ~{add_servers} server(s) for the window.",
            "detail": note,
        }
    if quieter:
        return {
            "window": label,
            "direction": "down",
            "headline": f"{label}: expected quieter than usual",
            "recommendation": "Consider trimming one shift to protect labor margin.",
            "detail": note,
        }
    return {
        "window": label,
        "direction": "steady",
        "headline": f"{label}: staffing looks balanced",
        "recommendation": "No change needed.",
        "detail": note,
    }
