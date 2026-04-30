from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, func, select

from ..db import get_session
from ..models import (
    ApprovalStatus,
    Appointment,
    AppointmentStatus,
    Notification,
    NotificationKind,
    NotificationStatus,
    PaymentStatus,
    Provider,
    Review,
    Role,
    Service,
    User,
)
from ..notifications_service import process_due
from ..schemas import AppointmentOut, ProviderOut
from ..security import require_role

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_role(Role.admin))])


@router.get("/dashboard")
def dashboard(session: Session = Depends(get_session)) -> dict:
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    week_start = today_start - timedelta(days=7)

    total_users = session.exec(select(func.count()).select_from(User)).one()
    total_customers = session.exec(
        select(func.count()).select_from(User).where(User.role == Role.customer)
    ).one()
    total_providers = session.exec(select(func.count()).select_from(Provider)).one()
    pending_providers = session.exec(
        select(func.count()).select_from(Provider).where(
            Provider.approval_status == ApprovalStatus.pending
        )
    ).one()
    suspended_providers = session.exec(
        select(func.count()).select_from(Provider).where(
            Provider.approval_status == ApprovalStatus.suspended
        )
    ).one()

    bookings_today = session.exec(
        select(func.count()).select_from(Appointment).where(Appointment.start_at >= today_start)
    ).one()
    bookings_week = session.exec(
        select(func.count()).select_from(Appointment).where(Appointment.created_at >= week_start)
    ).one()
    cancellations_week = session.exec(
        select(func.count())
        .select_from(Appointment)
        .where(
            Appointment.created_at >= week_start,
            Appointment.status.in_([
                AppointmentStatus.cancelled_by_customer,
                AppointmentStatus.cancelled_by_provider,
            ]),
        )
    ).one()

    # Gross booking value across confirmed + completed appointments (cents)
    gbv_cents = session.exec(
        select(func.coalesce(func.sum(Appointment.total_price_cents), 0))
        .where(
            Appointment.status.in_([AppointmentStatus.confirmed, AppointmentStatus.completed])
        )
    ).one()

    deposits_held_cents = session.exec(
        select(func.coalesce(func.sum(Appointment.deposit_amount_cents), 0))
        .where(Appointment.payment_status == PaymentStatus.paid)
    ).one()

    return {
        "users": {"total": total_users, "customers": total_customers},
        "providers": {
            "total": total_providers,
            "pending": pending_providers,
            "suspended": suspended_providers,
        },
        "bookings": {
            "today": bookings_today,
            "last_7_days": bookings_week,
            "cancellations_last_7_days": cancellations_week,
        },
        "gross_booking_value_cents": gbv_cents,
        "deposits_held_cents": deposits_held_cents,
    }


@router.get("/providers", response_model=list[ProviderOut])
def list_providers(
    status: Optional[ApprovalStatus] = Query(None),
    session: Session = Depends(get_session),
) -> list[ProviderOut]:
    stmt = select(Provider)
    if status:
        stmt = stmt.where(Provider.approval_status == status)
    stmt = stmt.order_by(Provider.created_at.desc())
    rows = session.exec(stmt).all()
    return [ProviderOut.model_validate(p, from_attributes=True) for p in rows]


@router.post("/providers/{provider_id}/approve", response_model=ProviderOut)
def approve_provider(provider_id: int, session: Session = Depends(get_session)) -> ProviderOut:
    p = session.get(Provider, provider_id)
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    p.approval_status = ApprovalStatus.approved
    p.suspended_reason = ""
    session.add(p)
    session.commit()
    session.refresh(p)
    return ProviderOut.model_validate(p, from_attributes=True)


@router.post("/providers/{provider_id}/suspend", response_model=ProviderOut)
def suspend_provider(
    provider_id: int,
    reason: str = Query("", max_length=500),
    session: Session = Depends(get_session),
) -> ProviderOut:
    p = session.get(Provider, provider_id)
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    p.approval_status = ApprovalStatus.suspended
    p.suspended_reason = reason
    session.add(p)
    session.commit()
    session.refresh(p)
    return ProviderOut.model_validate(p, from_attributes=True)


@router.get("/bookings", response_model=list[AppointmentOut])
def list_bookings(
    status: Optional[AppointmentStatus] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    session: Session = Depends(get_session),
) -> list[AppointmentOut]:
    stmt = select(Appointment).order_by(Appointment.created_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(Appointment.status == status)
    rows = session.exec(stmt).all()

    out: list[AppointmentOut] = []
    for a in rows:
        provider = session.get(Provider, a.provider_id)
        service = session.get(Service, a.service_id)
        has_review = session.exec(
            select(Review).where(Review.appointment_id == a.id)
        ).first() is not None
        out.append(
            AppointmentOut(
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
                can_review=False,
            )
        )
    return out


@router.get("/notifications")
def list_notifications(
    status: Optional[NotificationStatus] = Query(None),
    kind: Optional[NotificationKind] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    session: Session = Depends(get_session),
) -> list[dict]:
    stmt = select(Notification).order_by(Notification.scheduled_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(Notification.status == status)
    if kind:
        stmt = stmt.where(Notification.kind == kind)
    rows = session.exec(stmt).all()
    return [
        {
            "id": n.id,
            "user_id": n.user_id,
            "appointment_id": n.appointment_id,
            "kind": n.kind,
            "channel": n.channel,
            "to_address": n.to_address,
            "subject": n.subject,
            "status": n.status,
            "scheduled_at": n.scheduled_at.isoformat(),
            "sent_at": n.sent_at.isoformat() if n.sent_at else None,
            "error": n.error,
        }
        for n in rows
    ]


@router.post("/notifications/run")
def run_notifications_now(session: Session = Depends(get_session)) -> dict:
    sent = process_due(session)
    return {"sent": sent}


@router.get("/users")
def list_users(
    role: Optional[Role] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    session: Session = Depends(get_session),
) -> list[dict]:
    stmt = select(User).order_by(User.created_at.desc()).limit(limit)
    if role:
        stmt = stmt.where(User.role == role)
    rows = session.exec(stmt).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "role": u.role,
            "created_at": u.created_at.isoformat(),
        }
        for u in rows
    ]
