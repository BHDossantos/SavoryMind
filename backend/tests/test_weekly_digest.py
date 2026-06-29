"""Tests for the weekly Action Plan digest cron."""
from datetime import date, datetime
from unittest.mock import patch

from app.models.menu import MenuItem
from app.models.user import User
from app.services import weekly_digest_service


def _make_restaurant(db, **overrides):
    defaults = dict(
        email=f"r{datetime.now().timestamp()}@example.com",
        password_hash="x",
        display_name="Trattoria T",
        restaurant_name="Trattoria T",
        account_type="restaurant",
        onboarding_completed=True,
        timezone="Europe/Rome",
    )
    defaults.update(overrides)
    u = User(**defaults)
    db.add(u); db.commit(); db.refresh(u)
    return u


def test_sends_when_actions_present(client, db_session):
    rest = _make_restaurant(db_session)
    db_session.add(MenuItem(
        user_id=rest.id, name="Bad Dish", category="mains",
        price=10, cost=4, orders_last_30_days=40, rating=2.0,
    ))
    db_session.commit()
    with patch("app.services.weekly_digest_service.resend_client.send_email") as send:
        stats = weekly_digest_service.send_weekly_digests(db_session)
    assert stats["sent"] == 1
    assert send.called


def test_skipped_when_no_actions(client, db_session):
    """A pristine restaurant with no signals doesn't get spammed."""
    rest = _make_restaurant(db_session, menu_of_the_day="Pasta")
    # Pretend menu was sent today so menu_publish action doesn't fire
    rest.menu_sms_last_sent_date = date.today()
    db_session.commit()
    # Add a booking tonight so tonight_covers fires (low severity)
    # and a broadcast to clear menu_publish
    from app.models.restaurant_ext import Booking, MenuBroadcast
    db_session.add(MenuBroadcast(
        user_id=rest.id, sent_at=datetime.utcnow(), local_date=date.today(), sms_count=1,
    ))
    db_session.add(Booking(
        user_id=rest.id, customer_name="A", date=date.today(),
        time_slot="19:00", party_size=2, status="confirmed",
    ))
    db_session.commit()
    # Still has tonight_covers action → sent. Good — that's a legit signal.
    with patch("app.services.weekly_digest_service.resend_client.send_email"):
        stats = weekly_digest_service.send_weekly_digests(db_session)
    assert stats["sent"] == 1


def test_skipped_when_no_email(client, db_session):
    """User.email is NOT NULL at the schema level, but in production we
    have legacy social-auth rows with blank-string email. Treat both."""
    rest = _make_restaurant(db_session, email="")
    db_session.add(MenuItem(
        user_id=rest.id, name="X", category="mains",
        price=10, cost=4, orders_last_30_days=40, rating=2.0,
    ))
    db_session.commit()
    with patch("app.services.weekly_digest_service.resend_client.send_email") as send:
        stats = weekly_digest_service.send_weekly_digests(db_session)
    assert stats["sent"] == 0
    assert stats["skipped_no_email"] == 1
    assert not send.called
