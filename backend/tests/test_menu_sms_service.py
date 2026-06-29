"""Tests for the menu-of-the-day SMS broadcast cron.

Pins the contract: fires only at restaurant-local 11am, only for
opted-in CRM customers with a phone, only once per local day, skipped
when the menu is empty, idempotent across runs, and correct across
timezones.
"""
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

from zoneinfo import ZoneInfo

from app.models.restaurant_ext import CRMCustomer
from app.models.user import User
from app.services import menu_sms_service


def _make_restaurant(
    db,
    *,
    tz="Europe/Rome",
    menu="Tagliatelle al ragù — €14\nTiramisù — €6",
    slug="trattoria-test",
    last_sent=None,
    language="it",
):
    u = User(
        email=f"r{datetime.now().timestamp()}@example.com",
        password_hash="x",
        display_name="Trattoria Test",
        restaurant_name="Trattoria Test",
        account_type="restaurant",
        onboarding_completed=True,
        timezone=tz,
        menu_of_the_day=menu,
        menu_sms_last_sent_date=last_sent,
        slug=slug,
        language=language,
    )
    db.add(u); db.commit(); db.refresh(u)
    return u


def _make_customer(db, restaurant_id, *, phone="+393334445566", opt_in=True, name="Alessia"):
    c = CRMCustomer(
        user_id=restaurant_id,
        name=name,
        phone=phone,
        menu_sms_opt_in=opt_in,
    )
    db.add(c); db.commit(); db.refresh(c)
    return c


def _utc_when_rome_is(hour: int, minute: int = 0) -> datetime:
    """Return a UTC datetime that, when expressed in Europe/Rome, falls
    on the given hour:minute. Anchored to today's date — caller doesn't
    need to worry about DST because we astimezone() into Rome and back."""
    rome = ZoneInfo("Europe/Rome")
    today_rome = datetime.now(rome).date()
    local = datetime.combine(today_rome, datetime.min.time()).replace(
        hour=hour, minute=minute, tzinfo=rome,
    )
    return local.astimezone(timezone.utc)


def test_broadcast_fires_at_local_11am(client, db_session):
    rest = _make_restaurant(db_session)
    _make_customer(db_session, rest.id)

    with patch("app.services.menu_sms_service.twilio_client.send_sms", return_value=True) as send_sms:
        stats = menu_sms_service.send_due_menus(db_session, now=_utc_when_rome_is(11, 5))

    assert stats["restaurants_broadcast"] == 1
    assert stats["sms_sent"] == 1
    assert send_sms.called
    body = send_sms.call_args.args[1]
    assert "Trattoria Test" in body
    assert "Tagliatelle" in body
    # Italian language → Italian booking line
    assert "Prenota:" in body
    assert "/r/trattoria-test" in body


def test_broadcast_skips_outside_window(client, db_session):
    rest = _make_restaurant(db_session)
    _make_customer(db_session, rest.id)

    with patch("app.services.menu_sms_service.twilio_client.send_sms") as send_sms:
        # 8am Rome — too early
        stats = menu_sms_service.send_due_menus(db_session, now=_utc_when_rome_is(8))

    assert stats["restaurants_broadcast"] == 0
    assert stats["restaurants_skipped_window"] == 1
    assert not send_sms.called


def test_broadcast_skips_empty_menu(client, db_session):
    rest = _make_restaurant(db_session, menu="")
    _make_customer(db_session, rest.id)

    with patch("app.services.menu_sms_service.twilio_client.send_sms") as send_sms:
        stats = menu_sms_service.send_due_menus(db_session, now=_utc_when_rome_is(11))

    # Restaurant filtered out by SQL since menu is empty
    assert stats["restaurants_broadcast"] == 0
    assert not send_sms.called


def test_broadcast_skips_opt_out_customers(client, db_session):
    rest = _make_restaurant(db_session)
    _make_customer(db_session, rest.id, opt_in=False)
    _make_customer(db_session, rest.id, opt_in=True, phone="+393334440001", name="Marco")

    with patch("app.services.menu_sms_service.twilio_client.send_sms", return_value=True) as send_sms:
        stats = menu_sms_service.send_due_menus(db_session, now=_utc_when_rome_is(11))

    assert stats["sms_sent"] == 1
    assert stats["customers_skipped_no_opt_in"] == 1
    assert send_sms.call_count == 1


def test_broadcast_skips_no_phone(client, db_session):
    rest = _make_restaurant(db_session)
    _make_customer(db_session, rest.id, phone=None)
    _make_customer(db_session, rest.id, phone="", name="Empty")

    with patch("app.services.menu_sms_service.twilio_client.send_sms") as send_sms:
        stats = menu_sms_service.send_due_menus(db_session, now=_utc_when_rome_is(11))

    assert stats["sms_sent"] == 0
    assert stats["customers_skipped_no_phone"] == 2
    assert not send_sms.called


def test_broadcast_idempotent_within_same_day(client, db_session):
    rest = _make_restaurant(db_session)
    _make_customer(db_session, rest.id)

    with patch("app.services.menu_sms_service.twilio_client.send_sms", return_value=True):
        first = menu_sms_service.send_due_menus(db_session, now=_utc_when_rome_is(11))
        second = menu_sms_service.send_due_menus(db_session, now=_utc_when_rome_is(11, 30))

    assert first["sms_sent"] == 1
    assert second["sms_sent"] == 0
    assert second["restaurants_skipped_already_sent"] == 1
    # The flag is set to the restaurant's local today
    db_session.refresh(rest)
    today_rome = datetime.now(ZoneInfo("Europe/Rome")).date()
    assert rest.menu_sms_last_sent_date == today_rome


def test_broadcast_respects_timezone_independence(client, db_session):
    """Same UTC instant: Rome restaurant is in-window, NYC restaurant is not."""
    rome = _make_restaurant(db_session, tz="Europe/Rome", slug="rome-test")
    nyc = _make_restaurant(db_session, tz="America/New_York", slug="nyc-test", language="en")
    _make_customer(db_session, rome.id)
    _make_customer(db_session, nyc.id, phone="+12125550100", name="Jane")

    with patch("app.services.menu_sms_service.twilio_client.send_sms", return_value=True) as send_sms:
        # 11am Rome = 5am NYC (or 6am EDT) — both outside NYC's window
        stats = menu_sms_service.send_due_menus(db_session, now=_utc_when_rome_is(11))

    assert stats["restaurants_broadcast"] == 1
    assert stats["restaurants_skipped_window"] == 1
    assert send_sms.call_count == 1
    # The one SMS that went out was the Rome customer
    body = send_sms.call_args.args[1]
    assert "/r/rome-test" in body


def test_broadcast_marks_sent_even_with_zero_opted_in_customers(client, db_session):
    """A restaurant with no opted-in customers should still flip the flag
    so it's not re-evaluated every hour for the rest of the day."""
    rest = _make_restaurant(db_session)
    # Customer who didn't opt in
    _make_customer(db_session, rest.id, opt_in=False)

    with patch("app.services.menu_sms_service.twilio_client.send_sms") as send_sms:
        stats = menu_sms_service.send_due_menus(db_session, now=_utc_when_rome_is(11))

    assert stats["sms_sent"] == 0
    assert stats["restaurants_broadcast"] == 1
    db_session.refresh(rest)
    assert rest.menu_sms_last_sent_date is not None
    assert not send_sms.called


def test_broadcast_clamps_long_menu(client, db_session):
    """Long menus get clamped with ellipsis so SMS doesn't run multi-segment."""
    long_menu = ("Antipasti misti: bruschetta al pomodoro, prosciutto crudo, "
                 "salumi della casa, formaggi misti, melanzane alla parmigiana. ") * 5
    rest = _make_restaurant(db_session, menu=long_menu)
    _make_customer(db_session, rest.id)

    with patch("app.services.menu_sms_service.twilio_client.send_sms", return_value=True) as send_sms:
        menu_sms_service.send_due_menus(db_session, now=_utc_when_rome_is(11))

    body = send_sms.call_args.args[1]
    # Should be clamped, ending in ellipsis somewhere in the body
    assert "…" in body
    # Body length stays reasonable (~intro + 300 chars menu + booking line)
    assert len(body) < 500


def test_broadcast_without_slug_omits_booking_url(client, db_session):
    rest = _make_restaurant(db_session, slug=None)
    _make_customer(db_session, rest.id)

    with patch("app.services.menu_sms_service.twilio_client.send_sms", return_value=True) as send_sms:
        menu_sms_service.send_due_menus(db_session, now=_utc_when_rome_is(11))

    body = send_sms.call_args.args[1]
    assert "Prenota:" not in body
    assert "/r/" not in body
