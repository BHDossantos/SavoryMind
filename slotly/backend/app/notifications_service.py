"""Enqueue + send transactional notifications for booking events."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from sqlmodel import Session, select

from .email_client import send_email
from .models import (
    Appointment,
    Notification,
    NotificationKind,
    NotificationStatus,
    Provider,
    Service,
    User,
)

logger = logging.getLogger("availablenow.notifications")


def _format_when(start_at: datetime) -> str:
    return start_at.strftime("%a %d %b %Y at %H:%M")


def _render(
    kind: NotificationKind,
    *,
    customer: User,
    provider: Provider,
    service: Service,
    appt: Appointment,
) -> tuple[str, str]:
    when = _format_when(appt.start_at)
    where = ", ".join(p for p in [provider.address, provider.neighborhood, provider.city] if p)
    base_signoff = "\n\n— AvailableNow"

    if kind == NotificationKind.booking_confirmed:
        subject = f"Booking confirmed · {service.name} at {provider.display_name}"
        body = (
            f"Hi {customer.first_name},\n\n"
            f"Your booking is confirmed.\n\n"
            f"Service: {service.name}\n"
            f"Provider: {provider.display_name}\n"
            f"When: {when}\n"
            f"Where: {where}\n\n"
            f"You can manage this booking in My Appointments."
            f"{base_signoff}"
        )
    elif kind == NotificationKind.reminder_24h:
        subject = f"Tomorrow · {service.name} at {provider.display_name}"
        body = (
            f"Hi {customer.first_name},\n\n"
            f"Reminder: you have an appointment tomorrow.\n\n"
            f"Service: {service.name}\n"
            f"Provider: {provider.display_name}\n"
            f"When: {when}\n"
            f"Where: {where}\n\n"
            f"Need to cancel? Do it now to avoid losing your deposit."
            f"{base_signoff}"
        )
    elif kind == NotificationKind.reminder_2h:
        subject = f"In 2 hours · {service.name} at {provider.display_name}"
        body = (
            f"Hi {customer.first_name},\n\n"
            f"Your appointment is in about 2 hours.\n\n"
            f"Service: {service.name}\n"
            f"Provider: {provider.display_name}\n"
            f"When: {when}\n"
            f"Where: {where}"
            f"{base_signoff}"
        )
    elif kind == NotificationKind.booking_cancelled:
        subject = f"Cancelled · {service.name} at {provider.display_name}"
        body = (
            f"Hi {customer.first_name},\n\n"
            f"Your booking has been cancelled.\n\n"
            f"Service: {service.name}\n"
            f"Provider: {provider.display_name}\n"
            f"When: {when}"
            f"{base_signoff}"
        )
    else:
        subject = "AvailableNow update"
        body = "You have an update about your booking."
    return subject, body


def enqueue_for_appointment(session: Session, appointment_id: int) -> list[int]:
    """Schedule confirmation + 24h + 2h reminders for an appointment.

    Idempotent: skips kinds that are already enqueued for this appointment.
    Returns the ids of newly created notifications.
    """
    appt = session.get(Appointment, appointment_id)
    if not appt:
        return []
    customer = session.get(User, appt.customer_id)
    provider = session.get(Provider, appt.provider_id)
    service = session.get(Service, appt.service_id)
    if not (customer and provider and service):
        return []

    plan: list[tuple[NotificationKind, datetime]] = [
        (NotificationKind.booking_confirmed, datetime.utcnow()),
        (NotificationKind.reminder_24h, appt.start_at - timedelta(hours=24)),
        (NotificationKind.reminder_2h, appt.start_at - timedelta(hours=2)),
    ]

    created: list[int] = []
    for kind, scheduled_at in plan:
        existing = session.exec(
            select(Notification).where(
                Notification.appointment_id == appt.id,
                Notification.kind == kind,
            )
        ).first()
        if existing:
            continue
        subject, body = _render(kind, customer=customer, provider=provider, service=service, appt=appt)
        n = Notification(
            user_id=customer.id,
            appointment_id=appt.id,
            kind=kind,
            to_address=customer.email,
            subject=subject,
            body=body,
            scheduled_at=scheduled_at,
        )
        session.add(n)
        session.flush()
        created.append(n.id)
    return created


def enqueue_cancellation(session: Session, appointment_id: int) -> int | None:
    """Send a cancellation email immediately and cancel any pending reminders."""
    appt = session.get(Appointment, appointment_id)
    if not appt:
        return None
    customer = session.get(User, appt.customer_id)
    provider = session.get(Provider, appt.provider_id)
    service = session.get(Service, appt.service_id)
    if not (customer and provider and service):
        return None

    pending = session.exec(
        select(Notification).where(
            Notification.appointment_id == appt.id,
            Notification.status == NotificationStatus.pending,
            Notification.kind.in_([
                NotificationKind.reminder_24h,
                NotificationKind.reminder_2h,
            ]),
        )
    ).all()
    for n in pending:
        n.status = NotificationStatus.cancelled
        session.add(n)

    subject, body = _render(
        NotificationKind.booking_cancelled,
        customer=customer,
        provider=provider,
        service=service,
        appt=appt,
    )
    n = Notification(
        user_id=customer.id,
        appointment_id=appt.id,
        kind=NotificationKind.booking_cancelled,
        to_address=customer.email,
        subject=subject,
        body=body,
        scheduled_at=datetime.utcnow(),
    )
    session.add(n)
    session.flush()
    return n.id


def process_due(session: Session, now: datetime | None = None, limit: int = 100) -> int:
    """Send notifications whose scheduled_at <= now. Returns count sent."""
    now = now or datetime.utcnow()
    due = session.exec(
        select(Notification)
        .where(
            Notification.status == NotificationStatus.pending,
            Notification.scheduled_at <= now,
        )
        .order_by(Notification.scheduled_at)
        .limit(limit)
    ).all()

    sent = 0
    for n in due:
        try:
            message_id = send_email(to=n.to_address, subject=n.subject, body_text=n.body)
            n.status = NotificationStatus.sent
            n.sent_at = datetime.utcnow()
            n.provider_message_id = message_id
            sent += 1
        except Exception as e:  # noqa: BLE001
            n.status = NotificationStatus.failed
            n.error = str(e)[:500]
            logger.warning("Notification %s failed: %s", n.id, e)
        session.add(n)
    if due:
        session.commit()
    return sent
