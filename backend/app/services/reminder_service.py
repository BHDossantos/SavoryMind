"""Day-before reminders for confirmed bookings.

The single feature that determines whether restaurants love or hate the
booking flow: no-shows. Without a reminder, ~20-30% of confirmed
bookings ghost the restaurant — every empty table is lost revenue and
the restaurant blames the platform. Sending the diner a polite reminder
24 hours before drops no-shows to ~5%.

Triggered by Cloud Scheduler (or any cron) hitting
POST /internal/jobs/booking-reminders every 15 minutes. The job is
idempotent — each booking has a `reminder_sent_at` flag, so re-running
or overlapping cron ticks won't double-send.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from html import escape
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.restaurant_ext import Booking
from ..models.user import User
from . import resend_client, twilio_client


# Send a reminder when the booking start is between WINDOW_LO and WINDOW_HI
# from now. Keeps the cron's catchment narrow enough to avoid spamming and
# wide enough that a 15-minute cron schedule won't miss anything.
WINDOW_LO_HOURS = 18
WINDOW_HI_HOURS = 26


def _booking_local_dt(booking: Booking, restaurant: User) -> datetime:
    """Return the booking's start in the restaurant's local timezone.

    Restaurant.timezone is an IANA string (e.g. "Europe/Rome"); fallback
    to UTC if unset so the math still works on legacy rows.
    """
    tz_name = restaurant.timezone or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")
    hour, minute = (booking.time_slot or "19:00").split(":")
    naive = datetime.combine(booking.date, datetime.min.time()).replace(
        hour=int(hour), minute=int(minute)
    )
    return naive.replace(tzinfo=tz)


def send_due_reminders(db: Session, *, now: datetime | None = None) -> dict:
    """Find confirmed bookings whose local start is ~24h away and remind
    the diner. Returns counts for the caller to log/return."""
    if now is None:
        now = datetime.now(timezone.utc)

    lo = now + timedelta(hours=WINDOW_LO_HOURS)
    hi = now + timedelta(hours=WINDOW_HI_HOURS)

    # Coarse filter on `date` first to keep the candidate set small —
    # then check the precise local datetime in Python. The date range that
    # could possibly contain a booking 18-26h from now is at most 2 days.
    candidate_dates = [
        (now + timedelta(hours=WINDOW_LO_HOURS)).date(),
        (now + timedelta(hours=WINDOW_HI_HOURS)).date(),
    ]
    candidate_dates = sorted(set(candidate_dates))

    candidates = (
        db.query(Booking)
        .filter(
            Booking.status.in_(["confirmed", "seated"]),
            Booking.reminder_sent_at.is_(None),
            Booking.date.in_(candidate_dates),
        )
        .all()
    )

    sent_email = 0
    sent_sms = 0
    skipped_no_channel = 0

    for b in candidates:
        restaurant = db.query(User).filter(User.id == b.user_id).first()
        if not restaurant:
            continue

        local_dt = _booking_local_dt(b, restaurant)
        # Compare in UTC to stay correct across DST boundaries.
        local_utc = local_dt.astimezone(timezone.utc)
        if not (lo <= local_utc <= hi):
            continue

        rest_label = restaurant.restaurant_name or restaurant.display_name or "the restaurant"
        if b.customer_email:
            _send_diner_reminder_email(
                b.customer_email,
                rest_label=rest_label,
                customer_name=b.customer_name,
                party_size=b.party_size,
                booking_date=str(b.date),
                booking_time=b.time_slot,
            )
            sent_email += 1
        if b.customer_phone:
            _send_diner_reminder_sms(
                b.customer_phone,
                rest_label=rest_label,
                party_size=b.party_size,
                booking_date=str(b.date),
                booking_time=b.time_slot,
            )
            sent_sms += 1
        if not b.customer_email and not b.customer_phone:
            skipped_no_channel += 1

        # Mark sent even if both channels were no-ops — we don't want to
        # repeatedly attempt to remind a guest with no contact info, and
        # the providers themselves are configured to no-op silently when
        # unset, so distinguishing "tried and failed" from "tried and
        # succeeded" requires provider-side telemetry we don't surface
        # here. Booking gets reminded once.
        b.reminder_sent_at = datetime.utcnow()

    db.commit()

    return {
        "candidates":         len(candidates),
        "reminders_sent":     sent_email + sent_sms,
        "emails_sent":        sent_email,
        "sms_sent":           sent_sms,
        "skipped_no_channel": skipped_no_channel,
    }


def _send_diner_reminder_email(
    to: str,
    *,
    rest_label: str,
    customer_name: str,
    party_size: int,
    booking_date: str,
    booking_time: str,
) -> None:
    safe_rest = escape(rest_label)
    safe_name = escape(customer_name or "")
    safe_date = escape(booking_date)
    safe_time = escape(booking_time)
    safe_party = escape(str(party_size))

    subject = f"Reminder: your booking at {rest_label} tomorrow at {booking_time}"
    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
      <h1 style="font-size:18px;margin:0 0 12px;">Hi {safe_name}, just a reminder of your booking tomorrow:</h1>
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:12px;margin:16px 0;">
        <tr><td style="padding:8px 12px;color:#6b7280;"><strong>Restaurant</strong></td><td style="padding:8px 12px;">{safe_rest}</td></tr>
        <tr><td style="padding:8px 12px;color:#6b7280;"><strong>Date</strong></td><td style="padding:8px 12px;">{safe_date}</td></tr>
        <tr><td style="padding:8px 12px;color:#6b7280;"><strong>Time</strong></td><td style="padding:8px 12px;">{safe_time}</td></tr>
        <tr><td style="padding:8px 12px;color:#6b7280;"><strong>Party</strong></td><td style="padding:8px 12px;">{safe_party}</td></tr>
      </table>
      <p style="font-size:13px;color:#4b5563;">If something changed, please let the restaurant know — they're counting on your table.</p>
    </div>
    """.strip()
    resend_client.send_email(to, subject, html)


def _send_diner_reminder_sms(
    to: str,
    *,
    rest_label: str,
    party_size: int,
    booking_date: str,
    booking_time: str,
) -> None:
    body = (
        f"Reminder from SavoryMind: you have a booking at {rest_label} "
        f"on {booking_date} at {booking_time}, party of {party_size}. "
        f"If something changed, please let the restaurant know."
    )
    twilio_client.send_sms(to, body)
