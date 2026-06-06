"""Tests for the day-before booking reminder cron.

Pins the contract: a confirmed booking 24h from now gets a reminder;
one 5 days out or 2 hours out doesn't; the same booking doesn't get
reminded twice; cancelled/pending bookings are excluded.
"""
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

from app.models.restaurant_ext import Booking
from app.models.user import User
from app.services import reminder_service


def _make_restaurant(db, *, tz="Europe/Rome"):
    u = User(
        email=f"r{datetime.now().timestamp()}@example.com",
        password_hash="x",
        display_name="Trattoria Test",
        restaurant_name="Trattoria Test",
        account_type="restaurant",
        onboarding_completed=True,
        timezone=tz,
    )
    db.add(u); db.commit(); db.refresh(u)
    return u


def _make_booking(db, restaurant_id, *, when, status="confirmed", email="g@example.com", phone="+393334445566"):
    """`when` is a Python datetime in restaurant-local time."""
    b = Booking(
        user_id=restaurant_id,
        customer_name="Alessia",
        customer_email=email,
        customer_phone=phone,
        date=when.date(),
        time_slot=when.strftime("%H:%M"),
        party_size=2,
        status=status,
        source="public",
    )
    db.add(b); db.commit(); db.refresh(b)
    return b


def test_reminder_fires_for_booking_24h_out(client, db_session):
    rest = _make_restaurant(db_session)
    # 24 hours from now, in Rome local time
    now_utc = datetime.now(timezone.utc)
    rome_in_24h = (now_utc + timedelta(hours=24)).astimezone(reminder_service.ZoneInfo("Europe/Rome"))
    b = _make_booking(db_session, rest.id, when=rome_in_24h.replace(tzinfo=None))

    with patch("app.services.reminder_service.resend_client.send_email") as send_email, \
         patch("app.services.reminder_service.twilio_client.send_sms") as send_sms:
        stats = reminder_service.send_due_reminders(db_session)

    assert stats["reminders_sent"] >= 2  # email + SMS for the one booking
    assert send_email.called
    assert send_sms.called

    db_session.refresh(b)
    assert b.reminder_sent_at is not None


def test_reminder_skips_booking_5_days_out(client, db_session):
    rest = _make_restaurant(db_session)
    far_future = datetime.now(timezone.utc) + timedelta(days=5)
    _make_booking(db_session, rest.id, when=far_future.replace(tzinfo=None))

    with patch("app.services.reminder_service.resend_client.send_email") as send_email:
        stats = reminder_service.send_due_reminders(db_session)

    assert stats["reminders_sent"] == 0
    assert not send_email.called


def test_reminder_skips_booking_2h_out(client, db_session):
    """A 2-hours-from-now slot is too close to be a 'day before' reminder
    — the diner is presumably already on their way."""
    rest = _make_restaurant(db_session)
    soon = datetime.now(timezone.utc) + timedelta(hours=2)
    _make_booking(db_session, rest.id, when=soon.replace(tzinfo=None))

    with patch("app.services.reminder_service.resend_client.send_email") as send_email:
        stats = reminder_service.send_due_reminders(db_session)

    assert stats["reminders_sent"] == 0
    assert not send_email.called


def test_reminder_idempotent_across_runs(client, db_session):
    rest = _make_restaurant(db_session)
    rome_in_24h = (
        datetime.now(timezone.utc) + timedelta(hours=24)
    ).astimezone(reminder_service.ZoneInfo("Europe/Rome"))
    _make_booking(db_session, rest.id, when=rome_in_24h.replace(tzinfo=None))

    with patch("app.services.reminder_service.resend_client.send_email") as send_email, \
         patch("app.services.reminder_service.twilio_client.send_sms"):
        first  = reminder_service.send_due_reminders(db_session)
        second = reminder_service.send_due_reminders(db_session)

    assert first["reminders_sent"] >= 1
    assert second["reminders_sent"] == 0


def test_reminder_skips_pending_and_cancelled(client, db_session):
    rest = _make_restaurant(db_session)
    rome_in_24h = (
        datetime.now(timezone.utc) + timedelta(hours=24)
    ).astimezone(reminder_service.ZoneInfo("Europe/Rome"))
    _make_booking(db_session, rest.id, when=rome_in_24h.replace(tzinfo=None), status="pending")
    _make_booking(db_session, rest.id, when=rome_in_24h.replace(tzinfo=None), status="cancelled")

    with patch("app.services.reminder_service.resend_client.send_email") as send_email:
        stats = reminder_service.send_due_reminders(db_session)

    assert stats["reminders_sent"] == 0
    assert not send_email.called


def test_reminder_marks_booking_even_when_no_contact_info(client, db_session):
    """Bookings with neither email nor phone shouldn't keep coming back
    around — mark them so the next cron tick doesn't reconsider them."""
    rest = _make_restaurant(db_session)
    rome_in_24h = (
        datetime.now(timezone.utc) + timedelta(hours=24)
    ).astimezone(reminder_service.ZoneInfo("Europe/Rome"))
    b = _make_booking(
        db_session, rest.id, when=rome_in_24h.replace(tzinfo=None),
        email=None, phone=None,
    )

    stats = reminder_service.send_due_reminders(db_session)
    assert stats["skipped_no_channel"] == 1
    db_session.refresh(b)
    assert b.reminder_sent_at is not None
