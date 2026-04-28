from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user
from app.models import Booking, Event, PartnerProfile, Plan, Promo, User, Venue
from app.schemas.venue import PromoCreate, VenueUpdate

router = APIRouter(prefix="/api/partner", tags=["partner"])


def _ensure_partner(user: User, db: Session) -> PartnerProfile:
    p = db.query(PartnerProfile).filter(PartnerProfile.user_id == user.id).first()
    if not p:
        raise HTTPException(403, "No partner profile. Contact admin.")
    return p


def _own_venue(p: PartnerProfile, venue_id: int) -> bool:
    return venue_id in (p.venue_ids or [])


class PartnerSelfRegister(BaseModel):
    company_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_whatsapp: Optional[str] = None
    push_token: Optional[str] = None


@router.post("/profile")
def upsert_profile(
    payload: PartnerSelfRegister,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = db.query(PartnerProfile).filter(PartnerProfile.user_id == user.id).first()
    if not p:
        p = PartnerProfile(user_id=user.id, venue_ids=[])
        db.add(p)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return {
        "id": p.id,
        "venue_ids": p.venue_ids,
        "company_name": p.company_name,
        "contact_phone": p.contact_phone,
        "contact_whatsapp": p.contact_whatsapp,
    }


@router.get("/venues")
def list_my_venues(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = _ensure_partner(user, db)
    venues = db.query(Venue).filter(Venue.id.in_(p.venue_ids or [])).all()
    return [{"id": v.id, "name": v.name, "slug": v.slug, "type": v.type, "active": v.active, "promoted": v.promoted} for v in venues]


@router.put("/venues/{venue_id}")
def update_my_venue(
    venue_id: int,
    payload: VenueUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = _ensure_partner(user, db)
    if not _own_venue(p, venue_id):
        raise HTTPException(403, "Not your venue")
    v = db.query(Venue).get(venue_id)
    if not v:
        raise HTTPException(404, "Venue not found")
    for k, val in payload.model_dump(exclude_none=True).items():
        setattr(v, k, val)
    db.commit()
    return {"ok": True}


@router.post("/promos")
def create_promo(
    payload: PromoCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = _ensure_partner(user, db)
    if not _own_venue(p, payload.venue_id):
        raise HTTPException(403, "Not your venue")
    promo = Promo(**payload.model_dump())
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return {"id": promo.id}


class EventIn(BaseModel):
    venue_id: int
    title: str
    description: Optional[str] = None
    starts_at: datetime
    ends_at: Optional[datetime] = None
    music_types: List[str] = []
    cover_charge_eur: int = 0
    image_url: Optional[str] = None
    promoted: bool = False


@router.post("/events")
def create_event(
    payload: EventIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = _ensure_partner(user, db)
    if not _own_venue(p, payload.venue_id):
        raise HTTPException(403, "Not your venue")
    e = Event(**payload.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return {"id": e.id}


@router.get("/bookings")
def list_my_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    status: Optional[str] = None,
):
    p = _ensure_partner(user, db)
    qry = db.query(Booking).filter(Booking.venue_id.in_(p.venue_ids or []))
    if status:
        qry = qry.filter(Booking.status == status)
    rows = qry.order_by(Booking.created_at.desc()).limit(200).all()
    return [
        {
            "id": b.id,
            "venue_id": b.venue_id,
            "status": b.status,
            "date": b.date,
            "time": b.time,
            "group_size": b.group_size,
            "request_type": b.request_type,
            "vip_interest": b.vip_interest,
            "contact_name": b.contact_name,
            "contact_phone": b.contact_phone,
            "contact_email": b.contact_email,
            "notes": b.notes,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }
        for b in rows
    ]


class BookingStatusIn(BaseModel):
    status: str
    response: Optional[str] = None


@router.put("/bookings/{booking_id}/status")
def update_booking_status(
    booking_id: int,
    payload: BookingStatusIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = _ensure_partner(user, db)
    b = db.query(Booking).get(booking_id)
    if not b:
        raise HTTPException(404, "Not found")
    if b.venue_id not in (p.venue_ids or []):
        raise HTTPException(403, "Not your booking")
    prev_status = b.status
    b.status = payload.status
    b.venue_response = payload.response
    db.commit()
    if prev_status != b.status:
        from app.services import notifications
        venue = db.query(Venue).get(b.venue_id)
        if venue:
            notifications.notify_booking_status_change(
                db, b, venue,
                user_email=b.contact_email,
                user_phone=b.contact_phone,
            )
    return {"ok": True}


@router.get("/analytics")
def analytics(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    days: int = 30,
):
    p = _ensure_partner(user, db)
    venue_ids = p.venue_ids or []
    if not venue_ids:
        return {"venue_ids": [], "summary": {}, "per_venue": []}
    cutoff = datetime.utcnow() - timedelta(days=days)
    bookings = db.query(Booking).filter(
        Booking.venue_id.in_(venue_ids),
        Booking.created_at >= cutoff,
    ).all()

    per_venue: dict[int, dict] = {}
    for v_id in venue_ids:
        per_venue[v_id] = {"venue_id": v_id, "requests": 0, "confirmed": 0, "vip": 0, "avg_group": 0, "vibes": {}}

    vibes_overall: dict[str, int] = {}
    budget_overall: list[int] = []
    group_sizes: list[int] = []

    plan_ids = [b.plan_id for b in bookings if b.plan_id]
    plans = {pl.id: pl for pl in db.query(Plan).filter(Plan.id.in_(plan_ids)).all()} if plan_ids else {}

    for b in bookings:
        per_venue[b.venue_id]["requests"] += 1
        if b.status == "confirmed":
            per_venue[b.venue_id]["confirmed"] += 1
        if b.vip_interest == "yes":
            per_venue[b.venue_id]["vip"] += 1
        group_sizes.append(b.group_size or 0)
        if b.budget_eur:
            budget_overall.append(b.budget_eur)
        pl = plans.get(b.plan_id) if b.plan_id else None
        if pl:
            for tag in pl.vibe_tags or []:
                vibes_overall[tag] = vibes_overall.get(tag, 0) + 1
                per_venue[b.venue_id]["vibes"][tag] = per_venue[b.venue_id]["vibes"].get(tag, 0) + 1

    summary = {
        "days": days,
        "total_requests": len(bookings),
        "total_confirmed": sum(1 for b in bookings if b.status == "confirmed"),
        "vip_requests": sum(1 for b in bookings if b.vip_interest == "yes"),
        "conversion_rate": round(
            sum(1 for b in bookings if b.status == "confirmed") / max(1, len(bookings)),
            3,
        ),
        "avg_group_size": round(sum(group_sizes) / max(1, len(group_sizes)), 2),
        "avg_budget_eur": round(sum(budget_overall) / max(1, len(budget_overall)), 2) if budget_overall else None,
        "top_vibes": sorted(vibes_overall.items(), key=lambda x: x[1], reverse=True)[:8],
    }
    return {
        "venue_ids": venue_ids,
        "summary": summary,
        "per_venue": list(per_venue.values()),
    }
