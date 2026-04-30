"""User-favourited venues. Stored in User.prefs.saved_venues as a list of slugs."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user
from app.models import User, Venue

router = APIRouter(prefix="/api/saved-venues", tags=["saved"])


def _slugs(user: User) -> list[str]:
    prefs = user.prefs or {}
    saved = prefs.get("saved_venues") or []
    return [str(s) for s in saved]


def _set_slugs(user: User, slugs: list[str]) -> None:
    prefs = dict(user.prefs or {})
    prefs["saved_venues"] = slugs
    user.prefs = prefs


@router.get("")
def list_saved(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    slugs = _slugs(user)
    if not slugs:
        return []
    venues = db.query(Venue).filter(Venue.slug.in_(slugs)).all()
    by_slug = {v.slug: v for v in venues}
    out = []
    for s in slugs:
        v = by_slug.get(s)
        if not v:
            continue
        out.append({
            "id": v.id, "slug": v.slug, "name": v.name, "type": v.type,
            "neighborhood": v.neighborhood, "city": v.city,
            "avg_price_eur": v.avg_price_eur, "vibe_tags": v.vibe_tags,
            "photos": v.photos, "vip_available": v.vip_available,
        })
    return out


class ToggleIn(BaseModel):
    slug: str


@router.post("/toggle")
def toggle(payload: ToggleIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    venue = db.query(Venue).filter(Venue.slug == payload.slug).first()
    if not venue:
        # Don't leak existence, but the toggle is a no-op
        return {"saved": False, "slugs": _slugs(user)}
    slugs = _slugs(user)
    if payload.slug in slugs:
        slugs = [s for s in slugs if s != payload.slug]
        saved = False
    else:
        slugs = slugs + [payload.slug]
        saved = True
    _set_slugs(user, slugs)
    db.commit()
    return {"saved": saved, "slugs": slugs}
