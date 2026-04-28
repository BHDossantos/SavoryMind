from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Event, Venue

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("")
def list_events(
    db: Session = Depends(get_db),
    city: str = "rome",
    from_dt: Optional[datetime] = Query(None, alias="from"),
    to_dt: Optional[datetime] = Query(None, alias="to"),
    music: Optional[str] = None,
    limit: int = 50,
):
    qry = (
        db.query(Event)
        .join(Venue, Venue.id == Event.venue_id)
        .filter(Event.active == True, Venue.city == city)  # noqa: E712
    )
    if from_dt:
        qry = qry.filter(Event.starts_at >= from_dt)
    if to_dt:
        qry = qry.filter(Event.starts_at <= to_dt)
    rows = qry.order_by(Event.starts_at.asc()).limit(limit).all()
    if music:
        rows = [e for e in rows if any(m.lower() == music.lower() for m in (e.music_types or []))]
    return [
        {
            "id": e.id,
            "venue_id": e.venue_id,
            "title": e.title,
            "description": e.description,
            "starts_at": e.starts_at.isoformat(),
            "ends_at": e.ends_at.isoformat() if e.ends_at else None,
            "music_types": e.music_types,
            "cover_charge_eur": e.cover_charge_eur,
            "image_url": e.image_url,
            "promoted": e.promoted,
        }
        for e in rows
    ]
