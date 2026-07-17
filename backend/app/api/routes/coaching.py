"""Staff coaching engine API (P2 §6). Restaurant-only.

Quick-log incidents (≤20s on mobile), generate + approve dignity-preserving
coaching plans, and read the recovered-€ counter for the dashboard.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.restaurant_ext import Staff
from ...models.user import User
from ...services import coaching_service, posthog_client

router = APIRouter(prefix="/coaching", tags=["coaching"])


def _require_restaurant(user: User) -> User:
    if user.account_type != "restaurant":
        raise HTTPException(status_code=403, detail="Restaurant account required.")
    return user


# ── Incidents ────────────────────────────────────────────────────────────────

class IncidentBody(BaseModel):
    staff_id: int
    type: str  # waste|portioning|speed|punctuality|quality
    euro_impact: float = Field(..., ge=0)
    quantity: Optional[float] = None
    unit: Optional[str] = None
    cause_tags: Optional[list[str]] = None
    notes: Optional[str] = None
    occurred_at: Optional[date] = None


@router.post("/incidents", status_code=201)
def log_incident(body: IncidentBody, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    try:
        inc = coaching_service.log_incident(
            db, current_user.id, staff_id=body.staff_id, type=body.type,
            euro_impact=body.euro_impact, quantity=body.quantity, unit=body.unit,
            cause_tags=body.cause_tags, notes=body.notes, occurred_at=body.occurred_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    posthog_client.capture(current_user.id, "incident_logged",
                           {"type": body.type, "euro": body.euro_impact})
    return coaching_service._incident_dict(inc)


@router.get("/incidents")
def list_incidents(staff_id: int, days: int = 30, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return {"incidents": coaching_service.recent_incidents(db, current_user.id, staff_id, days)}


# ── Plans ────────────────────────────────────────────────────────────────────

@router.post("/plans/generate")
def generate_plans(staff_id: Optional[int] = None, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    if staff_id:
        staff = db.query(Staff).filter(Staff.id == staff_id,
                                       Staff.user_id == current_user.id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found.")
        plan = coaching_service.generate_plan_for_staff(db, current_user, staff)
        plans = [plan] if plan else []
    else:
        plans = coaching_service.generate_all(db, current_user)
    for p in plans:
        posthog_client.capture(current_user.id, "plan_generated",
                               {"staff_id": p.staff_id, "by_model": p.generated_by_model})
    return {"plans": [coaching_service.plan_dict(p) for p in plans]}


@router.get("/plans")
def list_plans(status: Optional[str] = None, db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return {"plans": coaching_service.list_plans(db, current_user.id, status=status)}


@router.post("/plans/{plan_id}/approve")
def approve_plan(plan_id: int, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    plan = coaching_service.approve_plan(db, current_user.id, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")
    posthog_client.capture(current_user.id, "plan_approved", {"plan_id": plan_id})
    return coaching_service.plan_dict(plan)


@router.post("/plans/approve-all")
def approve_all(period: Optional[str] = None, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    n = coaching_service.approve_all(db, current_user.id, period=period)
    return {"approved": n}


@router.get("/recovered")
def recovered(db: Session = Depends(get_db),
              current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return coaching_service.recovered_this_month(db, current_user.id)


# ── Staff coaching fields (hourly cost, language, WhatsApp consent) ──────────

class StaffCoachingBody(BaseModel):
    hourly_cost: Optional[float] = None
    language: Optional[str] = None


@router.patch("/staff/{staff_id}")
def update_staff_coaching(staff_id: int, body: StaffCoachingBody,
                          db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    staff = db.query(Staff).filter(Staff.id == staff_id,
                                   Staff.user_id == current_user.id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found.")
    if body.hourly_cost is not None:
        staff.hourly_cost = body.hourly_cost
    if body.language is not None:
        staff.language = body.language
    db.commit()
    return {"id": staff.id, "hourly_cost": staff.hourly_cost, "language": staff.language}


class WhatsappConsentBody(BaseModel):
    whatsapp_number: str  # E.164; empty string clears (opt-out)


@router.post("/staff/{staff_id}/whatsapp")
def set_whatsapp_consent(staff_id: int, body: WhatsappConsentBody,
                         db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    """Record an employee's WhatsApp number + consent timestamp (GDPR
    lawful basis). Empty number clears both = opt-out."""
    _require_restaurant(current_user)
    staff = db.query(Staff).filter(Staff.id == staff_id,
                                   Staff.user_id == current_user.id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found.")
    num = (body.whatsapp_number or "").strip()
    if num:
        staff.whatsapp_number = num
        staff.whatsapp_consent_at = datetime.utcnow()
    else:
        staff.whatsapp_number = None
        staff.whatsapp_consent_at = None
    db.commit()
    return {"id": staff.id, "whatsapp_number": staff.whatsapp_number,
            "consented": staff.whatsapp_consent_at is not None}
