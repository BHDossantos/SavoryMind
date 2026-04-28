from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import City

router = APIRouter(prefix="/api/cities", tags=["cities"])


@router.get("")
def list_cities(db: Session = Depends(get_db)):
    rows = db.query(City).filter(City.active == True).order_by(City.name).all()  # noqa: E712
    return [
        {
            "slug": c.slug,
            "name": c.name,
            "country": c.country,
            "timezone": c.timezone,
            "currency": c.currency,
            "center": {"lat": c.center_lat, "lng": c.center_lng},
            "neighborhoods": c.neighborhoods,
            "nightlife_window": c.nightlife_window,
        }
        for c in rows
    ]


@router.get("/{slug}")
def city_detail(slug: str, db: Session = Depends(get_db)):
    c = db.query(City).filter(City.slug == slug).first()
    if not c:
        return {"error": "not_found"}
    return {
        "slug": c.slug,
        "name": c.name,
        "country": c.country,
        "timezone": c.timezone,
        "currency": c.currency,
        "center": {"lat": c.center_lat, "lng": c.center_lng},
        "neighborhoods": c.neighborhoods,
        "nightlife_window": c.nightlife_window,
    }
