from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_admin
from app.models import (
    Booking,
    City,
    Event,
    PartnerProfile,
    Payment,
    Plan,
    Promo,
    Subscription,
    User,
    Venue,
)
from app.schemas.venue import VenueCreate, VenueUpdate
from app.services import scoring

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), admin=Depends(require_admin), days: int = 30):
    cutoff = datetime.utcnow() - timedelta(days=days)
    plans_q = db.query(Plan).filter(Plan.created_at >= cutoff).count()
    bookings_q = db.query(Booking).filter(Booking.created_at >= cutoff).all()
    confirmed = sum(1 for b in bookings_q if b.status == "confirmed")
    vip = sum(1 for b in bookings_q if b.vip_interest == "yes")
    payments = db.query(Payment).filter(Payment.created_at >= cutoff, Payment.status == "succeeded").all()
    revenue = round(sum(p.amount_eur for p in payments), 2)
    return {
        "days": days,
        "users": db.query(User).count(),
        "venues": db.query(Venue).count(),
        "active_venues": db.query(Venue).filter(Venue.active == True).count(),  # noqa: E712
        "promoted_venues": db.query(Venue).filter(Venue.promoted == True).count(),  # noqa: E712
        "plans_generated": plans_q,
        "booking_requests": len(bookings_q),
        "confirmed_bookings": confirmed,
        "conversion_rate": round(confirmed / max(1, len(bookings_q)), 3),
        "vip_requests": vip,
        "revenue_eur": revenue,
        "subscriptions": db.query(Subscription).filter(Subscription.status == "active").count(),
        "weights": scoring.WEIGHTS,
    }


# Venues CRUD ----------------------------------------------------------------


def _v_to_dict(v: Venue) -> dict:
    return {
        "id": v.id,
        "slug": v.slug,
        "name": v.name,
        "type": v.type,
        "active": v.active,
        "promoted": v.promoted,
        "city": v.city,
        "neighborhood": v.neighborhood,
        "price_level": v.price_level,
        "avg_price_eur": v.avg_price_eur,
        "vibe_tags": v.vibe_tags,
        "music_types": v.music_types,
        "dress_code": v.dress_code,
        "vip_available": v.vip_available,
        "quality_score": v.quality_score,
        "partner_status": v.partner_status,
    }


@router.get("/venues")
def list_venues(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
    city: Optional[str] = None,
    q: Optional[str] = None,
):
    qry = db.query(Venue)
    if city:
        qry = qry.filter(Venue.city == city)
    if q:
        qry = qry.filter(Venue.name.ilike(f"%{q}%"))
    return [_v_to_dict(v) for v in qry.order_by(Venue.name).limit(500).all()]


@router.post("/venues")
def create_venue(payload: VenueCreate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    v = Venue(**payload.model_dump())
    db.add(v)
    db.commit()
    db.refresh(v)
    return _v_to_dict(v)


@router.put("/venues/{venue_id}")
def update_venue(venue_id: int, payload: VenueUpdate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    v = db.query(Venue).get(venue_id)
    if not v:
        raise HTTPException(404, "Not found")
    for k, val in payload.model_dump(exclude_none=True).items():
        setattr(v, k, val)
    db.commit()
    return _v_to_dict(v)


@router.delete("/venues/{venue_id}")
def delete_venue(venue_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    v = db.query(Venue).get(venue_id)
    if not v:
        raise HTTPException(404, "Not found")
    db.delete(v)
    db.commit()
    return {"ok": True}


# Bookings -------------------------------------------------------------------


class BookingStatusIn(BaseModel):
    status: str
    admin_notes: Optional[str] = None
    venue_response: Optional[str] = None
    commission_eur: Optional[float] = None


@router.get("/bookings")
def list_bookings(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
    status: Optional[str] = None,
    limit: int = 200,
):
    qry = db.query(Booking)
    if status:
        qry = qry.filter(Booking.status == status)
    rows = qry.order_by(Booking.created_at.desc()).limit(limit).all()
    return [
        {
            "id": b.id,
            "status": b.status,
            "venue_id": b.venue_id,
            "user_id": b.user_id,
            "plan_id": b.plan_id,
            "date": b.date,
            "time": b.time,
            "group_size": b.group_size,
            "request_type": b.request_type,
            "vip_interest": b.vip_interest,
            "contact_name": b.contact_name,
            "contact_phone": b.contact_phone,
            "contact_email": b.contact_email,
            "notes": b.notes,
            "admin_notes": b.admin_notes,
            "venue_response": b.venue_response,
            "commission_eur": b.commission_eur,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }
        for b in rows
    ]


@router.put("/bookings/{booking_id}")
def update_booking(
    booking_id: int,
    payload: BookingStatusIn,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    b = db.query(Booking).get(booking_id)
    if not b:
        raise HTTPException(404, "Not found")
    b.status = payload.status
    if payload.admin_notes is not None:
        b.admin_notes = payload.admin_notes
    if payload.venue_response is not None:
        b.venue_response = payload.venue_response
    if payload.commission_eur is not None:
        b.commission_eur = payload.commission_eur
    db.commit()
    return {"ok": True}


# Promos ---------------------------------------------------------------------


@router.get("/promos")
def list_promos(db: Session = Depends(get_db), admin=Depends(require_admin)):
    rows = db.query(Promo).order_by(Promo.id.desc()).limit(500).all()
    return [
        {
            "id": p.id,
            "venue_id": p.venue_id,
            "title": p.title,
            "type": p.type,
            "description": p.description,
            "starts_at": p.starts_at.isoformat() if p.starts_at else None,
            "ends_at": p.ends_at.isoformat() if p.ends_at else None,
            "active": p.active,
        }
        for p in rows
    ]


# Recommendation rules (read-only view + tunable weights) --------------------


class WeightsIn(BaseModel):
    weights: dict


@router.get("/rules")
def get_rules(admin=Depends(require_admin)):
    return {
        "weights": scoring.WEIGHTS,
        "budget_bands": scoring.BUDGET_BANDS,
        "dress_hierarchy": scoring.DRESS_HIERARCHY,
        "club_hour_minimum": "23:30",
        "max_total_travel_min_default": 30,
        "promoted_per_plan_cap": 1,
    }


@router.put("/rules/weights")
def update_weights(payload: WeightsIn, admin=Depends(require_admin)):
    if not isinstance(payload.weights, dict):
        raise HTTPException(400, "weights must be an object")
    total = sum(float(v) for v in payload.weights.values())
    if total <= 0:
        raise HTTPException(400, "weights sum must be > 0")
    # Normalize and replace in-memory weights
    for k, v in payload.weights.items():
        scoring.WEIGHTS[k] = float(v) / total
    return {"weights": scoring.WEIGHTS}


# Partner role assignment ----------------------------------------------------


class PartnerAssignIn(BaseModel):
    user_email: str
    venue_ids: List[int]
    company_name: Optional[str] = None


@router.post("/partner-assignments")
def assign_partner(
    payload: PartnerAssignIn,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    user = db.query(User).filter(User.email == payload.user_email).first()
    if not user:
        raise HTTPException(404, "User not found — they must register first")
    p = db.query(PartnerProfile).filter(PartnerProfile.user_id == user.id).first()
    if not p:
        p = PartnerProfile(user_id=user.id, venue_ids=[])
        db.add(p)
    p.venue_ids = payload.venue_ids
    if payload.company_name:
        p.company_name = payload.company_name
    db.commit()
    return {"ok": True, "user_id": user.id, "venue_ids": p.venue_ids}


# City management ------------------------------------------------------------


class CityIn(BaseModel):
    slug: str
    name: str
    country: str
    timezone: str = "Europe/Rome"
    currency: str = "EUR"
    center_lat: float
    center_lng: float
    neighborhoods: List[str] = []
    nightlife_window: dict = {}
    active: bool = True


@router.post("/cities")
def upsert_city(payload: CityIn, db: Session = Depends(get_db), admin=Depends(require_admin)):
    c = db.query(City).filter(City.slug == payload.slug).first()
    if not c:
        c = City(**payload.model_dump())
        db.add(c)
    else:
        for k, v in payload.model_dump().items():
            setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "slug": c.slug}


# Analytics ------------------------------------------------------------------


@router.get("/analytics/vibes")
def vibe_analytics(db: Session = Depends(get_db), admin=Depends(require_admin), days: int = 60):
    cutoff = datetime.utcnow() - timedelta(days=days)
    plans = db.query(Plan).filter(Plan.created_at >= cutoff).all()
    counts: dict[str, int] = {}
    for p in plans:
        for t in p.vibe_tags or []:
            counts[t] = counts.get(t, 0) + 1
    return {"days": days, "vibe_counts": counts, "total_plans": len(plans)}
