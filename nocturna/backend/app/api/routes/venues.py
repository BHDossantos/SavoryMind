from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Event, Promo, Venue

router = APIRouter(prefix="/api/venues", tags=["venues"])


def _venue_to_dict(v: Venue) -> dict:
    return {
        "id": v.id,
        "slug": v.slug,
        "name": v.name,
        "type": v.type,
        "description": v.description,
        "address": v.address,
        "lat": v.lat,
        "lng": v.lng,
        "neighborhood": v.neighborhood,
        "city": v.city,
        "country": v.country,
        "opening_hours": v.opening_hours,
        "best_arrival_time": v.best_arrival_time,
        "price_level": v.price_level,
        "avg_price_eur": v.avg_price_eur,
        "dress_code": v.dress_code,
        "music_types": v.music_types,
        "crowd_types": v.crowd_types,
        "vibe_tags": v.vibe_tags,
        "cuisine_tags": v.cuisine_tags,
        "reservation_required": v.reservation_required,
        "walk_in_ok": v.walk_in_ok,
        "vip_available": v.vip_available,
        "guestlist_required": v.guestlist_required,
        "contact": v.contact,
        "photos": v.photos,
        "menu_url": v.menu_url,
        "booking_url": v.booking_url,
        "capacity": v.capacity,
        "partner_status": v.partner_status,
        "promoted": v.promoted,
        "best_nights": v.best_nights,
        "active": v.active,
    }


@router.get("")
def list_venues(
    db: Session = Depends(get_db),
    city: str = Query("rome"),
    type: Optional[str] = None,
    vibe: Optional[str] = None,
    neighborhood: Optional[str] = None,
    promoted: Optional[bool] = None,
    vip: Optional[bool] = None,
    q: Optional[str] = None,
    limit: int = 100,
):
    qry = db.query(Venue).filter(Venue.city == city, Venue.active == True)  # noqa: E712
    if type:
        qry = qry.filter(Venue.type == type)
    if neighborhood:
        qry = qry.filter(Venue.neighborhood.ilike(neighborhood))
    if promoted is not None:
        qry = qry.filter(Venue.promoted == promoted)
    if vip:
        qry = qry.filter(Venue.vip_available == True)  # noqa: E712
    if q:
        qry = qry.filter(or_(Venue.name.ilike(f"%{q}%"), Venue.description.ilike(f"%{q}%")))
    rows = qry.limit(limit).all()
    if vibe:
        rows = [v for v in rows if any(t.lower() == vibe.lower() for t in (v.vibe_tags or []))]
    return [_venue_to_dict(v) for v in rows]


@router.get("/trending")
def trending(db: Session = Depends(get_db), city: str = "rome", limit: int = 8):
    rows = (
        db.query(Venue)
        .filter(Venue.city == city, Venue.active == True)  # noqa: E712
        .order_by(Venue.quality_score.desc(), Venue.promoted.desc())
        .limit(limit)
        .all()
    )
    return [_venue_to_dict(v) for v in rows]


@router.get("/hidden-gems")
def hidden_gems(db: Session = Depends(get_db), city: str = "rome", limit: int = 8):
    rows = (
        db.query(Venue)
        .filter(Venue.city == city, Venue.active == True)  # noqa: E712
        .all()
    )
    gems = [v for v in rows if any(t.lower() in ("hidden_gem", "local") for t in (v.vibe_tags or []))]
    gems.sort(key=lambda v: v.quality_score or 0, reverse=True)
    return [_venue_to_dict(v) for v in gems[:limit]]


@router.get("/{slug}")
def venue_detail(slug: str, db: Session = Depends(get_db)):
    v = db.query(Venue).filter(Venue.slug == slug).first()
    if not v:
        raise HTTPException(404, "Venue not found")
    promos = (
        db.query(Promo)
        .filter(Promo.venue_id == v.id, Promo.active == True)  # noqa: E712
        .all()
    )
    events = (
        db.query(Event)
        .filter(Event.venue_id == v.id, Event.active == True)  # noqa: E712
        .order_by(Event.starts_at.asc())
        .limit(10)
        .all()
    )
    return {
        **_venue_to_dict(v),
        "promos": [
            {
                "id": p.id,
                "title": p.title,
                "type": p.type,
                "description": p.description,
                "starts_at": p.starts_at.isoformat() if p.starts_at else None,
                "ends_at": p.ends_at.isoformat() if p.ends_at else None,
            }
            for p in promos
        ],
        "events": [
            {
                "id": e.id,
                "title": e.title,
                "description": e.description,
                "starts_at": e.starts_at.isoformat() if e.starts_at else None,
                "ends_at": e.ends_at.isoformat() if e.ends_at else None,
                "music_types": e.music_types,
                "cover_charge_eur": e.cover_charge_eur,
                "image_url": e.image_url,
            }
            for e in events
        ],
    }
