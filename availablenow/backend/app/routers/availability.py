from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..availability_engine import compute_slots
from ..db import get_session
from ..models import Availability, Provider, Role, Service, User
from ..schemas import AvailabilityIn, AvailabilityOut, SlotOut
from ..security import require_role

router = APIRouter(tags=["availability"])


def _my_provider(session: Session, user: User) -> Provider:
    p = session.exec(select(Provider).where(Provider.user_id == user.id)).first()
    if not p:
        raise HTTPException(status_code=400, detail="Create your provider profile first")
    return p


@router.get("/availability/mine", response_model=list[AvailabilityOut])
def list_mine(
    session: Session = Depends(get_session),
    user: User = Depends(require_role(Role.provider)),
) -> list[AvailabilityOut]:
    p = _my_provider(session, user)
    rows = session.exec(select(Availability).where(Availability.provider_id == p.id)).all()
    return [AvailabilityOut.model_validate(r, from_attributes=True) for r in rows]


@router.put("/availability/mine", response_model=list[AvailabilityOut])
def replace_mine(
    payload: list[AvailabilityIn],
    session: Session = Depends(get_session),
    user: User = Depends(require_role(Role.provider)),
) -> list[AvailabilityOut]:
    p = _my_provider(session, user)
    existing = session.exec(select(Availability).where(Availability.provider_id == p.id)).all()
    for row in existing:
        session.delete(row)
    session.flush()
    new_rows = [Availability(provider_id=p.id, **w.model_dump()) for w in payload]
    for r in new_rows:
        if r.day_of_week < 0 or r.day_of_week > 6:
            raise HTTPException(status_code=400, detail="day_of_week must be 0..6")
        if r.end_time <= r.start_time:
            raise HTTPException(status_code=400, detail="end_time must be after start_time")
        session.add(r)
    session.commit()
    for r in new_rows:
        session.refresh(r)
    return [AvailabilityOut.model_validate(r, from_attributes=True) for r in new_rows]


@router.get("/providers/{provider_id}/slots", response_model=list[SlotOut])
def public_slots(
    provider_id: int,
    service_id: int = Query(...),
    days: int = Query(7, ge=1, le=30),
    session: Session = Depends(get_session),
) -> list[SlotOut]:
    service = session.get(Service, service_id)
    if not service or service.provider_id != provider_id:
        raise HTTPException(status_code=404, detail="Service not found")
    now = datetime.utcnow()
    slots = compute_slots(
        session,
        provider_id=provider_id,
        service_duration_minutes=service.duration_minutes,
        window_start=now,
        window_end=now + timedelta(days=days),
    )
    return [SlotOut(start_at=s, end_at=e) for s, e in slots]
