"""Loss Discovery API — the "money number in 15 minutes" flow (P1).

Restaurant-only. Three data paths feed one engine:
  - profile-only:  POST /loss/estimate with no body
  - quick-audit:   POST /loss/estimate {"audit": {...}}   (Path B)
  - sales import:  POST /loss/import  (multipart CSV)      (Path A)
The reveal screen and the dashboard hero card both read GET /loss/latest.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...services import loss_engine, loss_discovery_service, sales_import_service
from ...services import posthog_client

router = APIRouter(prefix="/loss", tags=["loss"])


def _require_restaurant(user: User) -> User:
    if user.account_type != "restaurant":
        raise HTTPException(status_code=403, detail="Restaurant account required.")
    return user


@router.get("/audit-questions")
def audit_questions():
    """The 12-question quick-audit definition (Path B). The frontend
    localizes prompts/options by id; coefficients stay server-side."""
    return {
        "questions": [
            {"id": q["id"], "lever": q["lever"], "options": list(q["options"].keys())}
            for q in loss_engine.AUDIT_QUESTIONS
        ]
    }


class PublicEstimateBody(BaseModel):
    covers_per_day: Optional[int] = None
    avg_ticket_eur: Optional[float] = None
    staff_count: Optional[int] = None
    monthly_food_purchases_eur: Optional[float] = None
    audit: Optional[dict] = None


@router.post("/public-estimate")
def public_estimate(body: PublicEstimateBody):
    """Public, no-auth waste calculator (P3 lead magnet). Same engine as
    onboarding Path B so the calculator's number matches what the operator
    sees after signup — one source of truth. Nothing is persisted; the
    email-gated PDF/capture happens at the frontend/marketing layer."""
    profile = {
        "covers_per_day": body.covers_per_day,
        "avg_ticket_eur": body.avg_ticket_eur,
        "staff_count": body.staff_count,
        "monthly_food_purchases_eur": body.monthly_food_purchases_eur,
    }
    return loss_engine.estimate(profile, audit=body.audit)


class LeadBody(BaseModel):
    email: str
    restaurant_name: Optional[str] = None
    covers_per_day: Optional[int] = None
    avg_ticket_eur: Optional[float] = None
    staff_count: Optional[int] = None
    monthly_food_purchases_eur: Optional[float] = None
    band_low: Optional[float] = None
    band_high: Optional[float] = None
    source: Optional[str] = None


def _valid_email(email: str) -> bool:
    email = (email or "").strip()
    if not (3 < len(email) <= 255) or email.count("@") != 1:
        return False
    local, _, domain = email.partition("@")
    return bool(local) and "." in domain and not domain.startswith(".") and not domain.endswith(".")


@router.post("/lead")
def capture_lead(body: LeadBody, db: Session = Depends(get_db)):
    """Public, no-auth lead capture from the waste calculator. Turns funnel
    traffic into a contactable prospect, tied to the € number they saw."""
    from ...models.marketing import MarketingLead
    if not _valid_email(body.email):
        raise HTTPException(status_code=422, detail="Invalid email address.")
    lead = MarketingLead(
        email=body.email.strip().lower(),
        restaurant_name=(body.restaurant_name or None),
        source=(body.source or "calcolatore")[:40],
        profile={
            "covers_per_day": body.covers_per_day,
            "avg_ticket_eur": body.avg_ticket_eur,
            "staff_count": body.staff_count,
            "monthly_food_purchases_eur": body.monthly_food_purchases_eur,
        },
        band_low=body.band_low,
        band_high=body.band_high,
    )
    db.add(lead)
    db.commit()
    posthog_client.capture(f"lead:{lead.email}", "calculator_lead_captured",
                           {"source": lead.source, "band_high": body.band_high})
    return {"ok": True, "id": lead.id}


class EstimateBody(BaseModel):
    audit: Optional[dict] = None  # {question_id: option_key}


@router.post("/estimate")
def run_estimate(
    body: EstimateBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    row = loss_discovery_service.run_estimate(db, current_user, audit=body.audit)
    posthog_client.capture(current_user.id, "loss_estimate_revealed", {
        "data_path": row.data_path,
        "band_low": row.total_monthly_loss_low,
        "band_high": row.total_monthly_loss_high,
        "guarantee_triggered": row.guarantee_triggered,
    })
    return loss_discovery_service.to_dict(row)


@router.post("/import")
async def import_sales(
    file: UploadFile = File(...),
    overrides: Optional[str] = Form(default=None),  # JSON {canonical: header}
    audit: Optional[str] = Form(default=None),      # optional JSON audit answers
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 10MB).")

    import json
    ov = _safe_json(overrides)
    au = _safe_json(audit)
    parsed = sales_import_service.parse(raw, overrides=ov)

    if parsed["rows_imported"] == 0:
        # Don't fabricate an estimate from an unreadable file — tell the
        # operator what went wrong so they can fix the export or map columns.
        posthog_client.capture(current_user.id, "import_failed", {
            "reason": (parsed["quarantine"][0]["reason"] if parsed["quarantine"] else "unknown"),
        })
        return {"import": parsed, "estimate": None}

    row = loss_discovery_service.run_estimate(
        db, current_user, audit=au, sales_summary=parsed["summary"],
    )
    posthog_client.capture(current_user.id, "import_succeeded", {
        "rows": parsed["rows_imported"],
        "band_high": row.total_monthly_loss_high,
    })
    return {"import": parsed, "estimate": loss_discovery_service.to_dict(row)}


@router.get("/latest")
def latest(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    return loss_discovery_service.to_dict(
        loss_discovery_service.latest(db, current_user.id)
    )


def _safe_json(s):
    if not s:
        return None
    import json
    try:
        v = json.loads(s)
        return v if isinstance(v, dict) else None
    except (ValueError, TypeError):
        return None
