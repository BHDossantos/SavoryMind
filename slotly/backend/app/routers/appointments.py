from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..availability_engine import _overlaps_any, _payment_active
from ..db import get_session
from ..models import (
    Appointment,
    AppointmentStatus,
    Availability,
    BlockedTime,
    Payment,
    PaymentStatus,
    Provider,
    Review,
    Role,
    Service,
    User,
)
from ..notifications_service import enqueue_auto_fill, enqueue_cancellation, enqueue_for_appointment
from ..payments_client import create_checkout_session, refund_payment_intent
from ..schemas import AppointmentOut, BookingIn, BookingOut
from ..security import get_current_user

router = APIRouter(prefix="/appointments", tags=["appointments"])


def _to_out(session: Session, a: Appointment) -> AppointmentOut:
    provider = session.get(Provider, a.provider_id)
    service = session.get(Service, a.service_id)
    has_review = session.exec(
        select(Review).where(Review.appointment_id == a.id)
    ).first() is not None
    can_review = (
        not has_review
        and a.status in (AppointmentStatus.confirmed, AppointmentStatus.completed)
        and a.start_at <= datetime.utcnow()
    )
    return AppointmentOut(
        id=a.id,
        customer_id=a.customer_id,
        provider_id=a.provider_id,
        service_id=a.service_id,
        start_at=a.start_at,
        end_at=a.end_at,
        status=a.status,
        total_price_cents=a.total_price_cents,
        deposit_amount_cents=a.deposit_amount_cents,
        payment_status=a.payment_status,
        customer_notes=a.customer_notes,
        provider_display_name=provider.display_name if provider else None,
        service_name=service.name if service else None,
        has_review=has_review,
        can_review=can_review,
    )


def _slot_is_open(session: Session, provider_id: int, start_at: datetime, end_at: datetime) -> bool:
    weekly = session.exec(
        select(Availability).where(Availability.provider_id == provider_id)
    ).all()
    dow = start_at.weekday()
    fits = False
    for w in weekly:
        if w.day_of_week != dow:
            continue
        if w.start_time <= start_at.time() and end_at.time() <= w.end_time and start_at.date() == end_at.date():
            fits = True
            break
    if not fits:
        return False
    blocked = session.exec(
        select(BlockedTime).where(
            BlockedTime.provider_id == provider_id,
            BlockedTime.end_at > start_at,
            BlockedTime.start_at < end_at,
        )
    ).all()
    booked = session.exec(
        select(Appointment).where(
            Appointment.provider_id == provider_id,
            Appointment.status == AppointmentStatus.confirmed,
            Appointment.end_at > start_at,
            Appointment.start_at < end_at,
        )
    ).all()
    busy = [(b.start_at, b.end_at) for b in blocked] + [
        (a.start_at, a.end_at) for a in booked if _payment_active(a)
    ]
    return not _overlaps_any(start_at, end_at, busy)


@router.post("", response_model=BookingOut)
def create_appointment(
    payload: BookingIn,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> BookingOut:
    service = session.get(Service, payload.service_id)
    if not service or not service.active:
        raise HTTPException(status_code=404, detail="Service not found")
    start_at = payload.start_at.replace(tzinfo=None)
    end_at = start_at + timedelta(minutes=service.duration_minutes)
    if start_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Cannot book in the past")
    if not _slot_is_open(session, service.provider_id, start_at, end_at):
        raise HTTPException(status_code=409, detail="Slot is not available")

    needs_deposit = service.deposit_required and service.deposit_amount_cents > 0
    appt = Appointment(
        customer_id=user.id,
        provider_id=service.provider_id,
        service_id=service.id,
        start_at=start_at,
        end_at=end_at,
        total_price_cents=service.price_cents,
        deposit_amount_cents=service.deposit_amount_cents if needs_deposit else 0,
        payment_status=PaymentStatus.pending if needs_deposit else PaymentStatus.not_required,
        customer_notes=payload.customer_notes,
    )
    session.add(appt)
    session.flush()

    checkout_url: str | None = None
    payment_id: int | None = None
    if needs_deposit:
        provider = session.get(Provider, service.provider_id)
        payment = Payment(
            appointment_id=appt.id,
            customer_id=user.id,
            provider_id=service.provider_id,
            amount_cents=service.deposit_amount_cents,
            currency=service.currency,
            status=PaymentStatus.pending,
        )
        session.add(payment)
        session.flush()
        checkout = create_checkout_session(
            appointment_id=appt.id,
            payment_id=payment.id,
            amount_cents=service.deposit_amount_cents,
            currency=service.currency,
            description=f"Deposit · {service.name} at {provider.display_name if provider else ''}",
            customer_email=user.email,
        )
        payment.provider_session_id = checkout.id
        if checkout.payment_intent_id:
            payment.provider_payment_id = checkout.payment_intent_id
        session.add(payment)
        checkout_url = checkout.url
        payment_id = payment.id

    # No-deposit bookings are immediately confirmed → notify now.
    # Deposit bookings get notified by the payments webhook / stub-confirm flow.
    if not needs_deposit:
        enqueue_for_appointment(session, appt.id)

    session.commit()
    session.refresh(appt)
    return BookingOut(
        appointment=_to_out(session, appt),
        checkout_url=checkout_url,
        payment_id=payment_id,
    )


@router.get("/mine", response_model=list[AppointmentOut])
def my_appointments(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[AppointmentOut]:
    rows = session.exec(
        select(Appointment).where(Appointment.customer_id == user.id).order_by(Appointment.start_at.desc())
    ).all()
    return [_to_out(session, a) for a in rows]


@router.get("/provider", response_model=list[AppointmentOut])
def provider_appointments(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[AppointmentOut]:
    if user.role != Role.provider:
        raise HTTPException(status_code=403, detail="Forbidden")
    provider = session.exec(select(Provider).where(Provider.user_id == user.id)).first()
    if not provider:
        return []
    rows = session.exec(
        select(Appointment)
        .where(Appointment.provider_id == provider.id)
        .order_by(Appointment.start_at.desc())
    ).all()
    return [_to_out(session, a) for a in rows]


@router.post("/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(
    appointment_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> AppointmentOut:
    appt = session.get(Appointment, appointment_id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    provider = session.get(Provider, appt.provider_id)
    is_customer = appt.customer_id == user.id
    is_provider = provider and provider.user_id == user.id
    if not (is_customer or is_provider):
        raise HTTPException(status_code=403, detail="Forbidden")
    if appt.status != AppointmentStatus.confirmed:
        raise HTTPException(status_code=400, detail=f"Cannot cancel from status {appt.status}")

    appt.status = (
        AppointmentStatus.cancelled_by_customer
        if is_customer
        else AppointmentStatus.cancelled_by_provider
    )

    # Refund policy: full refund if cancelled >2h before start OR cancelled by provider.
    payment = session.exec(
        select(Payment).where(
            Payment.appointment_id == appt.id, Payment.status == PaymentStatus.paid
        )
    ).first()
    if payment:
        eligible_for_refund = is_provider or appt.start_at - datetime.utcnow() > timedelta(hours=2)
        if eligible_for_refund:
            refund = refund_payment_intent(payment.provider_payment_id, payment.amount_cents)
            payment.status = PaymentStatus.refunded
            payment.refunded_amount_cents = refund.amount_cents
            payment.updated_at = datetime.utcnow()
            session.add(payment)
            appt.payment_status = PaymentStatus.refunded
        # else: deposit forfeit, payment stays paid

    session.add(appt)
    enqueue_cancellation(session, appt.id)
    # Phase 07: broadcast the freed slot to recent searchers.
    enqueue_auto_fill(session, appt.id)
    session.commit()
    session.refresh(appt)
    return _to_out(session, appt)
