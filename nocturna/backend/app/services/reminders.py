"""Booking reminders.

Scans bookings whose start time falls within a given lookahead window and
hasn't been reminded yet. Sends an SMS + email + push (when configured)
and stamps Booking.reminder_sent_at so we never double-send.

Designed to be invoked by a periodic scheduler (Cloud Scheduler, cron, or
GitHub Actions schedule). Idempotent: re-running within the same minute
is safe.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Booking, PartnerProfile, Venue
from app.services import notifications, templates

log = logging.getLogger("nocturna.reminders")

# Statuses that should trigger a reminder. We skip rejected/cancelled etc.
ELIGIBLE_STATUSES = {"new", "pending", "confirmed"}


def _booking_starts_at(b: Booking) -> Optional[datetime]:
    try:
        return datetime.strptime(f"{b.date} {b.time}", "%Y-%m-%d %H:%M")
    except (TypeError, ValueError):
        return None


def find_due_bookings(db: Session, *, now: Optional[datetime] = None, lookahead_min: int = 60, window_min: int = 30) -> list[Booking]:
    """Return bookings starting between (now + lookahead − window) and (now + lookahead)
    that are eligible and haven't been reminded yet.

    With the defaults (lookahead=60, window=30), a 15-min cron picks up
    bookings 30–60 minutes out, which gives a comfortable inbox-arrival
    margin for SMS providers.
    """
    now = now or datetime.utcnow()
    target_late = now + timedelta(minutes=lookahead_min)
    target_early = target_late - timedelta(minutes=window_min)

    rows = db.query(Booking).filter(
        Booking.status.in_(ELIGIBLE_STATUSES),
        Booking.reminder_sent_at.is_(None),
    ).all()

    due: list[Booking] = []
    for b in rows:
        starts = _booking_starts_at(b)
        if not starts:
            continue
        if target_early <= starts <= target_late:
            due.append(b)
    return due


def send_reminder(db: Session, booking: Booking) -> dict:
    venue = db.query(Venue).get(booking.venue_id)
    if not venue:
        return {"skipped": True, "reason": "venue_missing", "booking_id": booking.id}

    subject, body = templates.booking_reminder(
        venue.name, booking.time, venue.address, venue.dress_code, booking.id,
    )

    expo_token: Optional[str] = None
    if booking.user_id:
        partner = db.query(PartnerProfile).filter(PartnerProfile.user_id == booking.user_id).first()
        if partner:
            expo_token = partner.push_token

    sent_channels: list[str] = []
    if booking.contact_email:
        notifications.send_email(db, booking.contact_email, subject, body, user_id=booking.user_id, booking_id=booking.id)
        sent_channels.append("email")
    if booking.contact_phone:
        notifications.send_sms(db, booking.contact_phone, body, user_id=booking.user_id, booking_id=booking.id)
        sent_channels.append("sms")
    if expo_token:
        notifications.send_push(db, expo_token, subject, body, data={"booking_id": booking.id, "kind": "reminder"}, user_id=booking.user_id, booking_id=booking.id)
        sent_channels.append("push")

    booking.reminder_sent_at = datetime.utcnow()
    db.commit()
    log.info("reminder sent for booking %d via %s", booking.id, ",".join(sent_channels))
    return {"booking_id": booking.id, "channels": sent_channels}


def run_due(db: Session, *, now: Optional[datetime] = None, lookahead_min: int = 60, window_min: int = 30) -> dict:
    """Process all due bookings. Safe to call repeatedly (idempotent)."""
    due = find_due_bookings(db, now=now, lookahead_min=lookahead_min, window_min=window_min)
    sent = [send_reminder(db, b) for b in due]
    return {"checked_at": (now or datetime.utcnow()).isoformat(), "sent_count": len(sent), "sent": sent}
