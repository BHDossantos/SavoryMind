from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from ..availability_engine import next_slot_for_provider
from ..db import get_session
from ..models import ApprovalStatus, Provider, Service
from ..schemas import ProviderSearchOut

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/providers", response_model=list[ProviderSearchOut])
def search_providers(
    category: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    available_now: bool = Query(False),
    max_price_cents: Optional[int] = Query(None),
    session: Session = Depends(get_session),
) -> list[ProviderSearchOut]:
    stmt = select(Provider).where(Provider.approval_status == ApprovalStatus.approved)
    if category:
        stmt = stmt.where(Provider.category == category)
    if city:
        stmt = stmt.where(Provider.city == city)
    providers = session.exec(stmt).all()

    results: list[ProviderSearchOut] = []
    for p in providers:
        services = session.exec(
            select(Service).where(Service.provider_id == p.id, Service.active == True)  # noqa: E712
        ).all()
        if not services:
            continue
        if max_price_cents is not None and min(s.price_cents for s in services) > max_price_cents:
            continue
        next_slot = next_slot_for_provider(session, p.id)
        if available_now:
            if not next_slot or next_slot > datetime.utcnow() + timedelta(hours=2):
                continue
        results.append(
            ProviderSearchOut(
                **ProviderOut_dict(p),
                next_slot=next_slot,
                min_price_cents=min(s.price_cents for s in services),
            )
        )
    # rank: available now first, then by next_slot, then by rating
    results.sort(
        key=lambda r: (
            0 if r.next_slot and r.next_slot <= datetime.utcnow() + timedelta(hours=2) else 1,
            r.next_slot or datetime.max,
            -r.average_rating,
        )
    )
    return results


def ProviderOut_dict(p: Provider) -> dict:
    return {
        "id": p.id,
        "user_id": p.user_id,
        "display_name": p.display_name,
        "bio": p.bio,
        "profile_photo_url": p.profile_photo_url,
        "category": p.category,
        "address": p.address,
        "city": p.city,
        "neighborhood": p.neighborhood,
        "languages": p.languages,
        "is_verified": p.is_verified,
        "average_rating": p.average_rating,
        "review_count": p.review_count,
    }
