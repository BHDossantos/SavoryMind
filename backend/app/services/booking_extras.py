"""Booking helpers: ICS calendar file + repeat-customer detection.

ICS lets the diner add the reservation to their calendar in one tap — the
public booking flow returns the URL after confirmation. Repeat detection
matches by phone (primary) or email (fallback) so the operator sees
"3rd visit · allergic to shellfish" inline on every booking card.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models.restaurant_ext import Booking


def build_ics(booking: Booking, *, restaurant_name: str, location: str = "") -> str:
    """Return a minimal RFC 5545 VCALENDAR for the booking. Conservative
    fields only — every calendar app handles these correctly."""
    hh, mm = (booking.time_slot or "19:00").split(":")
    start = datetime.combine(booking.date, datetime.min.time()).replace(
        hour=int(hh), minute=int(mm),
    )
    end = start + timedelta(hours=2)

    def _fmt(dt: datetime) -> str:
        return dt.strftime("%Y%m%dT%H%M%S")

    uid = f"booking-{booking.id}@savorymind.net"
    summary = _esc(f"Table at {restaurant_name}")
    desc = _esc(f"Party of {booking.party_size}. {booking.notes or ''}".strip())
    loc = _esc(location)

    # Note: emitting floating local time (no Z, no TZID). Diner calendars
    # generally handle this correctly because they treat the value as
    # local-to-the-event. Adding a VTIMEZONE block is the "correct" thing
    # but adds 30+ lines for marginal benefit on a 2-hour dinner slot.
    return (
        "BEGIN:VCALENDAR\r\n"
        "VERSION:2.0\r\n"
        "PRODID:-//SavoryMind//Booking//EN\r\n"
        "METHOD:PUBLISH\r\n"
        "BEGIN:VEVENT\r\n"
        f"UID:{uid}\r\n"
        f"DTSTAMP:{_fmt(datetime.utcnow())}Z\r\n"
        f"DTSTART:{_fmt(start)}\r\n"
        f"DTEND:{_fmt(end)}\r\n"
        f"SUMMARY:{summary}\r\n"
        f"DESCRIPTION:{desc}\r\n"
        f"LOCATION:{loc}\r\n"
        "STATUS:CONFIRMED\r\n"
        "END:VEVENT\r\n"
        "END:VCALENDAR\r\n"
    )


def _esc(s: str) -> str:
    """RFC 5545 text field escaping. Commas and semicolons must be escaped;
    newlines become literal \\n."""
    return (s or "").replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")


def repeat_visits_count(db: Session, *, user_id: int, phone: str, email: Optional[str]) -> int:
    """Count previous completed/seated/confirmed bookings from the same
    diner. Matches on phone (primary) or email (fallback). Cancelled and
    declined bookings don't count — those weren't real visits."""
    phone_n = (phone or "").strip()
    email_n = (email or "").strip()
    if not phone_n and not email_n:
        return 0
    q = db.query(Booking).filter(
        Booking.user_id == user_id,
        Booking.status.in_(["confirmed", "seated", "completed"]),
    )
    conds = []
    if phone_n:
        conds.append(Booking.customer_phone == phone_n)
    if email_n:
        conds.append(Booking.customer_email == email_n)
    q = q.filter(or_(*conds))
    return q.count()
