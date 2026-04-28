"""Compute open time slots for a provider given their availability and existing bookings."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Iterable

from sqlmodel import Session, select

from .models import Appointment, AppointmentStatus, Availability, BlockedTime, Service


def _combine(d: date, t: time) -> datetime:
    return datetime.combine(d, t)


def compute_slots(
    session: Session,
    provider_id: int,
    service_duration_minutes: int,
    window_start: datetime,
    window_end: datetime,
    step_minutes: int = 15,
    max_slots: int = 50,
) -> list[tuple[datetime, datetime]]:
    """Return open (start, end) slots for `service_duration_minutes` between window_start and window_end."""
    if service_duration_minutes <= 0 or window_end <= window_start:
        return []

    weekly = session.exec(
        select(Availability).where(Availability.provider_id == provider_id)
    ).all()
    by_day: dict[int, list[Availability]] = {}
    for w in weekly:
        by_day.setdefault(w.day_of_week, []).append(w)
    if not by_day:
        return []

    blocked = session.exec(
        select(BlockedTime).where(
            BlockedTime.provider_id == provider_id,
            BlockedTime.end_at > window_start,
            BlockedTime.start_at < window_end,
        )
    ).all()
    booked = session.exec(
        select(Appointment).where(
            Appointment.provider_id == provider_id,
            Appointment.status == AppointmentStatus.confirmed,
            Appointment.end_at > window_start,
            Appointment.start_at < window_end,
        )
    ).all()
    busy: list[tuple[datetime, datetime]] = [
        (b.start_at, b.end_at) for b in blocked
    ] + [(a.start_at, a.end_at) for a in booked]

    duration = timedelta(minutes=service_duration_minutes)
    step = timedelta(minutes=step_minutes)
    now = datetime.utcnow()

    slots: list[tuple[datetime, datetime]] = []
    cursor_day = window_start.date()
    end_day = window_end.date()
    while cursor_day <= end_day and len(slots) < max_slots:
        windows = by_day.get(cursor_day.weekday(), [])
        for w in windows:
            day_start = _combine(cursor_day, w.start_time)
            day_end = _combine(cursor_day, w.end_time)
            slot_start = max(day_start, window_start, now)
            # round up to step
            minutes_over = (slot_start.minute % step_minutes)
            if minutes_over or slot_start.second or slot_start.microsecond:
                slot_start = (slot_start + (step - timedelta(minutes=minutes_over))).replace(
                    second=0, microsecond=0
                )
            while slot_start + duration <= min(day_end, window_end):
                slot_end = slot_start + duration
                if not _overlaps_any(slot_start, slot_end, busy):
                    slots.append((slot_start, slot_end))
                    if len(slots) >= max_slots:
                        return slots
                slot_start += step
        cursor_day += timedelta(days=1)
    return slots


def _overlaps_any(start: datetime, end: datetime, ranges: Iterable[tuple[datetime, datetime]]) -> bool:
    for r_start, r_end in ranges:
        if start < r_end and end > r_start:
            return True
    return False


def next_slot_for_provider(
    session: Session,
    provider_id: int,
    horizon_days: int = 14,
) -> datetime | None:
    """Earliest open slot fitting the shortest active service."""
    services = session.exec(
        select(Service).where(Service.provider_id == provider_id, Service.active == True)  # noqa: E712
    ).all()
    if not services:
        return None
    duration = min(s.duration_minutes for s in services)
    now = datetime.utcnow()
    slots = compute_slots(
        session,
        provider_id=provider_id,
        service_duration_minutes=duration,
        window_start=now,
        window_end=now + timedelta(days=horizon_days),
        max_slots=1,
    )
    return slots[0][0] if slots else None
