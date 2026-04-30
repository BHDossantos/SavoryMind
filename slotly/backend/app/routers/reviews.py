from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_session
from ..models import Appointment, AppointmentStatus, Provider, Review, Service, User
from ..schemas import ReviewIn, ReviewOut
from ..security import get_current_user

router = APIRouter(tags=["reviews"])


def _to_out(session: Session, r: Review) -> ReviewOut:
    customer = session.get(User, r.customer_id)
    appt = session.get(Appointment, r.appointment_id)
    service = session.get(Service, appt.service_id) if appt else None
    return ReviewOut(
        id=r.id,
        appointment_id=r.appointment_id,
        customer_id=r.customer_id,
        provider_id=r.provider_id,
        rating=r.rating,
        comment=r.comment,
        created_at=r.created_at,
        customer_first_name=customer.first_name if customer else None,
        service_name=service.name if service else None,
    )


def _apply_review_to_provider(session: Session, provider_id: int, new_rating: int) -> None:
    """Additive update so seeded stats survive when the first real review lands."""
    provider = session.get(Provider, provider_id)
    if not provider:
        return
    old_total = provider.average_rating * provider.review_count
    provider.review_count += 1
    provider.average_rating = round((old_total + new_rating) / provider.review_count, 2)
    session.add(provider)


@router.post("/reviews", response_model=ReviewOut)
def create_review(
    payload: ReviewIn,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> ReviewOut:
    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1..5")
    appt = session.get(Appointment, payload.appointment_id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not your appointment")
    if appt.start_at > datetime.utcnow():
        raise HTTPException(status_code=400, detail="Appointment hasn't happened yet")
    if appt.status not in (AppointmentStatus.confirmed, AppointmentStatus.completed):
        raise HTTPException(status_code=400, detail=f"Cannot review appointment with status {appt.status}")
    existing = session.exec(
        select(Review).where(Review.appointment_id == appt.id)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already reviewed")

    review = Review(
        appointment_id=appt.id,
        customer_id=user.id,
        provider_id=appt.provider_id,
        rating=payload.rating,
        comment=payload.comment.strip(),
    )
    if appt.status == AppointmentStatus.confirmed:
        appt.status = AppointmentStatus.completed
        session.add(appt)
    session.add(review)
    _apply_review_to_provider(session, appt.provider_id, payload.rating)
    session.commit()
    session.refresh(review)
    return _to_out(session, review)


@router.get("/providers/{provider_id}/reviews", response_model=list[ReviewOut])
def list_provider_reviews(
    provider_id: int,
    session: Session = Depends(get_session),
) -> list[ReviewOut]:
    rows = session.exec(
        select(Review)
        .where(Review.provider_id == provider_id)
        .order_by(Review.created_at.desc())
    ).all()
    return [_to_out(session, r) for r in rows]


@router.get("/appointments/{appointment_id}/review", response_model=ReviewOut)
def get_appointment_review(
    appointment_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> ReviewOut:
    review = session.exec(
        select(Review).where(Review.appointment_id == appointment_id)
    ).first()
    if not review:
        raise HTTPException(status_code=404, detail="No review yet")
    appt = session.get(Appointment, appointment_id)
    provider = session.get(Provider, appt.provider_id) if appt else None
    is_customer = appt and appt.customer_id == user.id
    is_provider = provider and provider.user_id == user.id
    if not (is_customer or is_provider):
        raise HTTPException(status_code=403, detail="Forbidden")
    return _to_out(session, review)
