"""Build minimal RFC-5545 .ics calendar attachments for bookings.

We keep this module dependency-free (no `icalendar` / `vobject`). Times
are emitted as **floating local time** (no TZID) — most consumer calendar
apps treat them as the user's local zone, which matches user expectation
when they were already viewing booking times in the venue's local UI.
"""
from __future__ import annotations

import re
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional


# Default booking duration when we have no better signal.
DEFAULT_DURATION_HOURS = 2
PRODID = "-//Nocturna//Night Concierge 1.0//EN"


def _fmt_local(dt: datetime) -> str:
    """RFC 5545 floating-local DATE-TIME, e.g. 20260502T210000."""
    return dt.strftime("%Y%m%dT%H%M%S")


def _fmt_utc(dt: datetime) -> str:
    return dt.strftime("%Y%m%dT%H%M%SZ")


def _escape(text: Optional[str]) -> str:
    """Escape special chars per RFC 5545 §3.3.11."""
    if not text:
        return ""
    s = (
        text.replace("\\", "\\\\")
            .replace(";", r"\;")
            .replace(",", r"\,")
            .replace("\r\n", r"\n")
            .replace("\n", r"\n")
            .replace("\r", r"\n")
    )
    # Strip control chars except the escaped newline marker.
    return "".join(c for c in s if c == "\\" or c >= " ")


def _fold(line: str, limit: int = 75) -> list[str]:
    """RFC 5545 line folding — split long lines and continue with a space."""
    if len(line) <= limit:
        return [line]
    out = [line[:limit]]
    rest = line[limit:]
    while rest:
        out.append(" " + rest[: limit - 1])
        rest = rest[limit - 1:]
    return out


def _parse_booking_when(date_str: str, time_str: str) -> datetime:
    """Parse date+time into a naive datetime. Raises ValueError on bad input."""
    return datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")


def build_ics(
    *,
    booking_id: int | str,
    venue_name: str,
    venue_address: Optional[str],
    booking_date: str,        # "YYYY-MM-DD"
    booking_time: str,        # "HH:MM"
    group_size: int = 2,
    request_type: Optional[str] = None,
    dress_code: Optional[str] = None,
    plan_label: Optional[str] = None,
    duration_hours: int = DEFAULT_DURATION_HOURS,
    now: Optional[datetime] = None,
    uid: Optional[str] = None,
) -> str:
    """Build a single-event VCALENDAR string for the given booking."""
    start = _parse_booking_when(booking_date, booking_time)
    end = start + timedelta(hours=duration_hours)

    # Description body — multiline, will get escaped + folded.
    desc_parts = [f"Nocturna booking #{booking_id}"]
    if request_type:
        desc_parts.append(f"Type: {request_type.replace('_', ' ')}")
    desc_parts.append(f"Group: {group_size}")
    if dress_code:
        desc_parts.append(f"Dress: {dress_code}")
    if plan_label:
        desc_parts.append(f"Plan: {plan_label}")
    description = "\n".join(desc_parts)

    uid_value = uid or f"booking-{booking_id}-{secrets.token_hex(4)}@nocturna.app"
    dtstamp = _fmt_utc(now or datetime.utcnow())

    raw_lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{PRODID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{_escape(uid_value)}",
        f"DTSTAMP:{dtstamp}",
        f"DTSTART:{_fmt_local(start)}",
        f"DTEND:{_fmt_local(end)}",
        f"SUMMARY:{_escape(f'Nocturna · {venue_name}')}",
    ]
    if venue_address:
        raw_lines.append(f"LOCATION:{_escape(venue_address)}")
    raw_lines.extend([
        f"DESCRIPTION:{_escape(description)}",
        "STATUS:CONFIRMED",
        "TRANSP:OPAQUE",
        "END:VEVENT",
        "END:VCALENDAR",
    ])

    folded: list[str] = []
    for line in raw_lines:
        folded.extend(_fold(line))
    return "\r\n".join(folded) + "\r\n"


# Tiny structural validator used by tests (kept here so we don't add an icalendar dep).

_REQUIRED = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT",
    "UID:", "DTSTAMP:", "DTSTART:", "DTEND:", "SUMMARY:",
    "END:VEVENT", "END:VCALENDAR",
]


def looks_valid_vcalendar(text: str) -> bool:
    if not text or not text.startswith("BEGIN:VCALENDAR"):
        return False
    # Reverse line-folding before scanning.
    unfolded = re.sub(r"\r?\n[ \t]", "", text)
    lines = [ln.strip() for ln in unfolded.splitlines() if ln.strip()]
    for needle in _REQUIRED:
        if not any(ln.startswith(needle) for ln in lines):
            return False
    if lines[0] != "BEGIN:VCALENDAR" or lines[-1] != "END:VCALENDAR":
        return False
    return True
