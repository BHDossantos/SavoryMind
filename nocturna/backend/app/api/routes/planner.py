import secrets
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user_optional
from app.models import Plan, User, Venue
from app.services import analytics, recommender
from app.services.recommender import PlannerInput

router = APIRouter(prefix="/api", tags=["planner"])


class PlannerRequest(BaseModel):
    city: str = "rome"
    requested_for: Optional[datetime] = None
    intent: str = "dinner_drinks"
    vibe_tags: List[str] = Field(default_factory=list)
    music_pref: List[str] = Field(default_factory=list)
    cuisine_pref: List[str] = Field(default_factory=list)
    style: str = "casual"
    group_type: str = "friends"
    group_size: int = 2
    budget_band: str = "50-100"
    budget_per_person: int = 75
    neighborhood_pref: List[str] = Field(default_factory=list)
    user_lat: Optional[float] = None
    user_lng: Optional[float] = None
    accept_long_route: bool = False
    plan_count: int = 3


@router.post("/planner/generate")
def generate(
    req: PlannerRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    when = req.requested_for or datetime.utcnow()
    inp = PlannerInput(
        city=req.city,
        requested_for=when,
        intent=req.intent,
        vibe_tags=req.vibe_tags,
        music_pref=req.music_pref,
        cuisine_pref=req.cuisine_pref,
        style=req.style,
        group_type=req.group_type,
        group_size=req.group_size,
        budget_band=req.budget_band,
        budget_per_person=req.budget_per_person,
        neighborhood_pref=req.neighborhood_pref,
        user_lat=req.user_lat,
        user_lng=req.user_lng,
        accept_long_route=req.accept_long_route,
        plan_count=max(1, min(req.plan_count, 3)),
    )
    plans = recommender.generate_plans(db, inp)
    if not plans:
        analytics.capture("plan_generation_failed", distinct_id=str(user.id) if user else None,
                          properties={"city": req.city, "intent": req.intent, "budget_band": req.budget_band})
        raise HTTPException(404, "No plans match those constraints. Try widening budget or accepting longer routes.")
    analytics.capture(
        "plan_generated", distinct_id=str(user.id) if user else None,
        properties={"city": req.city, "intent": req.intent, "plans_count": len(plans),
                    "budget_band": req.budget_band, "vibe_tags": req.vibe_tags,
                    "group_type": req.group_type, "group_size": req.group_size},
    )

    # Persist each plan
    saved: List[dict] = []
    for p in plans:
        plan_row = Plan(
            user_id=user.id if user else None,
            share_token=secrets.token_urlsafe(10),
            city=req.city,
            requested_for=when,
            group_size=req.group_size,
            group_type=req.group_type,
            budget_per_person=req.budget_per_person,
            budget_band=req.budget_band,
            vibe_tags=req.vibe_tags,
            music_pref=req.music_pref,
            cuisine_pref=req.cuisine_pref,
            style=req.style,
            neighborhood_pref=req.neighborhood_pref,
            intent=req.intent,
            generated=p["stops"],
            plan_label=p["label"],
            estimated_cost_eur=p["estimated_cost_eur"],
            total_travel_min=p["total_travel_min"],
            vibe_score=p["vibe_score"],
            status="draft",
        )
        db.add(plan_row)
        db.commit()
        db.refresh(plan_row)
        saved.append({
            "id": plan_row.id,
            "share_token": plan_row.share_token,
            "label": plan_row.plan_label,
            "estimated_cost_eur": plan_row.estimated_cost_eur,
            "total_travel_min": plan_row.total_travel_min,
            "vibe_score": plan_row.vibe_score,
            "dress_code": p["dress_code"],
            "rationale": p["rationale"],
            "stops": plan_row.generated,
            "intent": plan_row.intent,
            "city": plan_row.city,
        })
    return {"plans": saved}


@router.get("/plans/{plan_id}")
def get_plan(
    plan_id: int,
    share: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    p = db.query(Plan).get(plan_id)
    if not p:
        raise HTTPException(404, "Plan not found")
    if p.share_token == share:
        pass
    elif user and p.user_id == user.id:
        pass
    elif p.user_id is None:
        pass
    else:
        raise HTTPException(403, "Plan is private")
    return _plan_dict(p, db)


@router.post("/plans/{plan_id}/share")
def share_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    p = db.query(Plan).get(plan_id)
    if not p:
        raise HTTPException(404, "Plan not found")
    if not p.share_token:
        p.share_token = secrets.token_urlsafe(10)
    p.status = "shared"
    db.commit()
    return {"share_url": f"/plan/share/{p.share_token}", "share_token": p.share_token}


@router.get("/plans/share/{token}")
def get_shared(token: str, db: Session = Depends(get_db)):
    p = db.query(Plan).filter(Plan.share_token == token).first()
    if not p:
        raise HTTPException(404, "Shared plan not found")
    return _plan_dict(p, db)


@router.get("/plans/me/list")
def my_plans(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_optional),
):
    if not user:
        return []
    rows = db.query(Plan).filter(Plan.user_id == user.id).order_by(Plan.id.desc()).limit(50).all()
    return [_plan_dict(p, db, light=True) for p in rows]


def _plan_dict(p: Plan, db: Session, light: bool = False) -> dict:
    base = {
        "id": p.id,
        "share_token": p.share_token,
        "city": p.city,
        "requested_for": p.requested_for.isoformat() if p.requested_for else None,
        "group_size": p.group_size,
        "group_type": p.group_type,
        "budget_per_person": p.budget_per_person,
        "budget_band": p.budget_band,
        "vibe_tags": p.vibe_tags,
        "music_pref": p.music_pref,
        "cuisine_pref": p.cuisine_pref,
        "style": p.style,
        "neighborhood_pref": p.neighborhood_pref,
        "intent": p.intent,
        "label": p.plan_label,
        "estimated_cost_eur": p.estimated_cost_eur,
        "total_travel_min": p.total_travel_min,
        "vibe_score": p.vibe_score,
        "status": p.status,
        "stops": p.generated,
    }
    if light:
        return base
    # Hydrate each stop with fresh venue info
    enriched = []
    for s in p.generated or []:
        v = db.query(Venue).get(s.get("venue_id"))
        enriched.append({**s, "venue": _venue_brief(v) if v else None})
    base["stops"] = enriched
    return base


def _venue_brief(v: Venue) -> dict:
    return {
        "id": v.id,
        "slug": v.slug,
        "name": v.name,
        "type": v.type,
        "neighborhood": v.neighborhood,
        "address": v.address,
        "photos": v.photos,
        "dress_code": v.dress_code,
        "vip_available": v.vip_available,
        "reservation_required": v.reservation_required,
        "contact": v.contact,
        "lat": v.lat,
        "lng": v.lng,
        "avg_price_eur": v.avg_price_eur,
        "vibe_tags": v.vibe_tags,
        "music_types": v.music_types,
    }
