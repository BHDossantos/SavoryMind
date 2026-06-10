"""Tests for the ICS calendar attachment on confirmed bookings.

Verify steps from GSD task `t-ics-attachment`:
  - build_ics emits valid VCALENDAR + VEVENT structure
  - confirmed status-change attaches a .ics to the email
  - other status transitions don't attach anything
  - existing notification tests (received / rejected / cancelled) still pass
"""
from __future__ import annotations

from datetime import datetime

import pytest

from app.models import Booking, NotificationLog, Venue
from app.services import calendar as ics
from app.services import notifications


def _hours():
    return {d: [{"open": "00:00", "close": "23:59"}] for d in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]}


def _venue(db, dress="elegant"):
    v = Venue(slug="v", name="Test Venue", type="restaurant", address="Via Test 42, Roma",
              lat=41.9, lng=12.5, neighborhood="Centro", city="rome", country="IT",
              opening_hours=_hours(), avg_price_eur=60, price_level=2, dress_code=dress,
              music_types=[], crowd_types=[], vibe_tags=[], cuisine_tags=[],
              contact={}, photos=[], best_nights=[], active=True, quality_score=0.9)
    db.add(v); db.commit(); db.refresh(v); return v


def _booking(db, venue, status="confirmed"):
    b = Booking(venue_id=venue.id, contact_name="Bruno", contact_phone="+39 1",
                contact_email="user@example.com", date="2026-05-02", time="21:00",
                group_size=2, request_type="dinner", status=status,
                venue_response="See you at 21:00")
    db.add(b); db.commit(); db.refresh(b); return b


# build_ics — structural correctness -----------------------------------------


def test_build_ics_passes_validator():
    text = ics.build_ics(
        booking_id=42, venue_name="Pierluigi",
        venue_address="Piazza de' Ricci 144, Roma",
        booking_date="2026-05-02", booking_time="21:00",
        group_size=4, request_type="dinner",
        dress_code="elegant", plan_label="Romantic Roman Night",
    )
    assert ics.looks_valid_vcalendar(text)


def test_build_ics_includes_all_event_fields():
    text = ics.build_ics(
        booking_id=7, venue_name="Goa Club",
        venue_address="Via Libetta 13",
        booking_date="2026-05-02", booking_time="23:30",
        group_size=6, request_type="guestlist",
    )
    # Crucial RFC 5545 properties — line folding may add `\r\n ` so check
    # unfolded.
    unfolded = text.replace("\r\n ", "")
    assert "BEGIN:VCALENDAR" in unfolded
    assert "VERSION:2.0" in unfolded
    assert "BEGIN:VEVENT" in unfolded
    assert "DTSTART:20260502T233000" in unfolded
    # 2-hour default duration
    assert "DTEND:20260503T013000" in unfolded
    assert "SUMMARY:Nocturna \\· Goa Club" not in unfolded  # midpoint dot stays
    assert "SUMMARY:Nocturna · Goa Club" in unfolded
    assert "LOCATION:Via Libetta 13" in unfolded
    assert "Group: 6" in unfolded
    assert "STATUS:CONFIRMED" in unfolded
    assert "END:VEVENT" in unfolded
    assert "END:VCALENDAR" in unfolded


def test_build_ics_escapes_commas_and_semicolons():
    text = ics.build_ics(
        booking_id=99, venue_name="Bar; with, special chars",
        venue_address="Via, with; chars",
        booking_date="2026-05-02", booking_time="21:00",
    )
    unfolded = text.replace("\r\n ", "")
    # Escaping per RFC 5545 §3.3.11
    assert r"SUMMARY:Nocturna · Bar\; with\, special chars" in unfolded
    assert r"LOCATION:Via\, with\; chars" in unfolded


def test_build_ics_rejects_bad_date():
    with pytest.raises(ValueError):
        ics.build_ics(
            booking_id=1, venue_name="X", venue_address="",
            booking_date="not-a-date", booking_time="21:00",
        )


def test_looks_valid_vcalendar_rejects_garbage():
    assert not ics.looks_valid_vcalendar("")
    assert not ics.looks_valid_vcalendar("BEGIN:VCALENDAR\nfoo\nEND:VCALENDAR")  # missing required fields
    assert not ics.looks_valid_vcalendar("hello world")


# notify_booking_status_change — wiring --------------------------------------


def test_confirmed_email_carries_ics_attachment(db):
    v = _venue(db)
    b = _booking(db, v, status="confirmed")
    notifications.notify_booking_status_change(
        db, b, v,
        user_email="user@example.com",
        user_phone=None,
    )
    emails = db.query(NotificationLog).filter_by(channel="email").all()
    assert len(emails) == 1
    e = emails[0]
    # Console-fallback path records attachment info in the payload so the
    # admin notifications log can render it.
    assert e.payload is not None
    assert e.payload["attachments"], "expected at least one attachment"
    att = e.payload["attachments"][0]
    assert att["filename"] == f"nocturna-booking-{b.id}.ics"
    assert att["type"].startswith("text/calendar")
    assert att["size"] > 0


def test_rejected_email_has_no_attachment(db):
    v = _venue(db)
    b = _booking(db, v, status="rejected")
    notifications.notify_booking_status_change(
        db, b, v,
        user_email="user@example.com",
        user_phone=None,
    )
    emails = db.query(NotificationLog).filter_by(channel="email").all()
    assert len(emails) == 1
    assert (emails[0].payload or {}).get("attachments") is None


def test_received_email_has_no_attachment(db):
    """Booking_received predates the ICS work — sanity check it stays clean."""
    v = _venue(db)
    b = _booking(db, v, status="new")
    notifications.notify_booking_received(
        db, b, v,
        user_email="user@example.com", user_phone="+39 1",
        whatsapp=None, expo_token=None,
    )
    emails = db.query(NotificationLog).filter_by(channel="email").all()
    assert len(emails) == 1
    assert (emails[0].payload or {}).get("attachments") is None
