"""Tests for the morning briefing email cron.

Pins the contract: a restaurant with bookings today gets exactly one
email summarising the floor; restaurants with no bookings get nothing;
restaurants without an email address are skipped; the body uses the
restaurant's language.
"""
from datetime import date
from unittest.mock import patch

from app.models.restaurant_ext import Booking
from app.models.user import User
from app.services import daily_briefing_service


def _make_restaurant(db, *, lang="it", email="owner@example.com", tz="Europe/Rome"):
    u = User(
        email=email, password_hash="x",
        display_name="Trattoria", restaurant_name="Trattoria",
        account_type="restaurant", onboarding_completed=True,
        timezone=tz, language=lang,
    )
    db.add(u); db.commit(); db.refresh(u)
    return u


def _make_booking(db, restaurant_id, *, when, party=2, name="Alice", status="confirmed"):
    b = Booking(
        user_id=restaurant_id,
        customer_name=name, customer_email=None, customer_phone="+393334445566",
        date=when, time_slot="19:30",
        party_size=party,
        status=status, source="public",
    )
    db.add(b); db.commit(); db.refresh(b)
    return b


def test_briefing_sent_to_restaurant_with_bookings_today(client, db_session):
    rest = _make_restaurant(db_session)
    _make_booking(db_session, rest.id, when=date.today(), party=4, name="Alessia")
    _make_booking(db_session, rest.id, when=date.today(), party=2, name="Marco")
    with patch("app.services.daily_briefing_service.resend_client.send_email") as send:
        stats = daily_briefing_service.send_daily_briefings(db_session)
    assert stats["emails_sent"] == 1
    assert stats["restaurants_with_bookings"] == 1
    assert stats["total_bookings"] == 2
    _to, subject, html = send.call_args.args
    # Italian operator → Italian briefing.
    assert "Oggi su SavoryMind" in subject
    assert "Alessia" in html and "Marco" in html
    assert "Coperti" in html or "Cliente" in html


def test_no_email_when_no_bookings_today(client, db_session):
    _make_restaurant(db_session)
    with patch("app.services.daily_briefing_service.resend_client.send_email") as send:
        stats = daily_briefing_service.send_daily_briefings(db_session)
    assert stats["emails_sent"] == 0
    assert not send.called


# Note: users.email is NOT NULL in the schema, so we can't fully simulate
# the no-email branch via the ORM. Registration paths guarantee an email
# exists. The defensive `if not restaurant.email` branch remains for the
# edge case of a future social-login flow that doesn't capture an email
# at signup.


def test_groups_bookings_by_restaurant(client, db_session):
    a = _make_restaurant(db_session, email="a@example.com")
    b = _make_restaurant(db_session, email="b@example.com")
    _make_booking(db_session, a.id, when=date.today(), name="A1")
    _make_booking(db_session, b.id, when=date.today(), name="B1")
    _make_booking(db_session, b.id, when=date.today(), name="B2")
    with patch("app.services.daily_briefing_service.resend_client.send_email") as send:
        stats = daily_briefing_service.send_daily_briefings(db_session)
    assert stats["emails_sent"] == 2  # one per restaurant, not per booking
    assert stats["restaurants_with_bookings"] == 2


def test_english_briefing_for_english_restaurant(client, db_session):
    rest = _make_restaurant(db_session, lang="en", email="en@example.com")
    _make_booking(db_session, rest.id, when=date.today())
    with patch("app.services.daily_briefing_service.resend_client.send_email") as send:
        daily_briefing_service.send_daily_briefings(db_session)
    _to, subject, _html = send.call_args.args
    assert "Today on SavoryMind" in subject


def test_excludes_cancelled_and_pending(client, db_session):
    rest = _make_restaurant(db_session)
    _make_booking(db_session, rest.id, when=date.today(), status="cancelled", name="Cancelled")
    _make_booking(db_session, rest.id, when=date.today(), status="pending",   name="Pending")
    _make_booking(db_session, rest.id, when=date.today(), status="confirmed", name="Confirmed")
    with patch("app.services.daily_briefing_service.resend_client.send_email") as send:
        stats = daily_briefing_service.send_daily_briefings(db_session)
    assert stats["total_bookings"] == 1
    _to, _subject, html = send.call_args.args
    assert "Confirmed" in html
    assert "Cancelled" not in html
    assert "Pending" not in html
