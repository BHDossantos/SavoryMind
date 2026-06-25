"""End-to-end attribution tests for the daily menu SMS broadcast.

Pins the renewal-conversation contract: a restaurant publishing a menu
gets a broadcast row, the SMS URL includes the broadcast id, the click
tracker increments per hit, the public booking endpoint stamps the
booking with menu_broadcast_id when the diner converts, and the
restaurant stats endpoint rolls those numbers up over 7 days.
"""
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch
from zoneinfo import ZoneInfo

from app.models.restaurant_ext import Booking, CRMCustomer, MenuBroadcast
from app.models.user import User
from app.services import menu_sms_service

from .conftest import register_user, auth_headers


def _make_restaurant(db, *, menu="Pasta al pomodoro — €12", tz="Europe/Rome",
                     slug="trattoria-attr"):
    u = User(
        email=f"r{datetime.now().timestamp()}@example.com",
        password_hash="x",
        display_name="Trattoria Attr",
        restaurant_name="Trattoria Attr",
        account_type="restaurant",
        onboarding_completed=True,
        timezone=tz,
        menu_of_the_day=menu,
        slug=slug,
        language="it",
    )
    db.add(u); db.commit(); db.refresh(u)
    return u


def _utc_when_rome_is(hour: int) -> datetime:
    rome = ZoneInfo("Europe/Rome")
    today_rome = datetime.now(rome).date()
    return datetime.combine(today_rome, datetime.min.time()).replace(
        hour=hour, tzinfo=rome,
    ).astimezone(timezone.utc)


def test_broadcast_creates_attribution_row_with_url_token(client, db_session):
    rest = _make_restaurant(db_session)
    c = CRMCustomer(user_id=rest.id, name="Alessia", phone="+393334445566",
                    menu_sms_opt_in=True)
    db_session.add(c); db_session.commit()

    captured = {}
    def fake_send(to, body):
        captured["body"] = body
        return True

    with patch("app.services.menu_sms_service.twilio_client.send_sms", side_effect=fake_send):
        menu_sms_service.send_due_menus(db_session, now=_utc_when_rome_is(11))

    broadcast = db_session.query(MenuBroadcast).filter_by(user_id=rest.id).one()
    assert broadcast.sms_count == 1
    assert broadcast.click_count == 0
    assert broadcast.local_date == datetime.now(ZoneInfo("Europe/Rome")).date()
    assert broadcast.menu_snapshot == "Pasta al pomodoro — €12"
    # SMS URL includes the broadcast id as the attribution token
    assert f"?b={broadcast.id}" in captured["body"]
    assert f"/r/{rest.slug}" in captured["body"]


def test_click_endpoint_increments_count(client, db_session):
    rest = _make_restaurant(db_session)
    b = MenuBroadcast(user_id=rest.id, sent_at=datetime.utcnow(),
                      local_date=date.today(), sms_count=5)
    db_session.add(b); db_session.commit(); db_session.refresh(b)

    res1 = client.post(f"/api/public/restaurants/menu-broadcasts/{b.id}/click")
    res2 = client.post(f"/api/public/restaurants/menu-broadcasts/{b.id}/click")
    assert res1.status_code == 204
    assert res2.status_code == 204

    db_session.refresh(b)
    assert b.click_count == 2


def test_click_endpoint_silent_on_unknown_id(client, db_session):
    # 204 even on unknown ids so the broadcast inventory isn't leaked.
    res = client.post("/api/public/restaurants/menu-broadcasts/99999/click")
    assert res.status_code == 204


def test_booking_stamped_with_broadcast_id(client, db_session):
    rest = _make_restaurant(db_session)
    b = MenuBroadcast(user_id=rest.id, sent_at=datetime.utcnow(),
                      local_date=date.today(), sms_count=1)
    db_session.add(b); db_session.commit(); db_session.refresh(b)

    res = client.post(
        f"/api/public/restaurants/{rest.slug}/book",
        json={
            "booking_date": str(date.today() + timedelta(days=2)),
            "booking_time": "19:00",
            "party_size": 2,
            "customer_name": "Marco",
            "customer_phone": "+393334445566",
            "menu_broadcast_id": b.id,
        },
    )
    assert res.status_code == 201, res.text
    booking_id = res.json()["booking_id"]

    booking = db_session.query(Booking).filter_by(id=booking_id).one()
    assert booking.menu_broadcast_id == b.id
    assert booking.source == "menu_sms"


def test_booking_rejects_attribution_to_other_restaurant(client, db_session):
    """A spoofed ?b=N for restaurant A must not stamp restaurant B's booking."""
    rest_a = _make_restaurant(db_session, slug="rest-a")
    rest_b = _make_restaurant(db_session, slug="rest-b")
    b_for_a = MenuBroadcast(user_id=rest_a.id, sent_at=datetime.utcnow(),
                            local_date=date.today(), sms_count=1)
    db_session.add(b_for_a); db_session.commit(); db_session.refresh(b_for_a)

    res = client.post(
        f"/api/public/restaurants/{rest_b.slug}/book",
        json={
            "booking_date": str(date.today() + timedelta(days=2)),
            "booking_time": "19:00",
            "party_size": 2,
            "customer_name": "Marco",
            "customer_phone": "+393334445566",
            "menu_broadcast_id": b_for_a.id,
        },
    )
    assert res.status_code == 201
    booking = db_session.query(Booking).filter_by(id=res.json()["booking_id"]).one()
    # Cross-restaurant attribution dropped silently; falls back to plain "public".
    assert booking.menu_broadcast_id is None
    assert booking.source == "public"


def test_stats_endpoint_rolls_up_7_days(client, db_session):
    token, user = register_user(client, email="ownerattr@example.com",
                                account_type="restaurant")
    headers = auth_headers(token)
    res = client.patch("/api/auth/profile", json={
        "display_name": "Owner",
        "restaurant_name": "Trattoria Stats",
        "city": "Roma",
        "country": "Italy",
        "onboarding_completed": True,
    }, headers=headers)
    assert res.status_code == 200
    user_id = res.json()["id"]

    # Seed 3 broadcast rows in window, 1 outside
    today = date.today()
    rows = [
        MenuBroadcast(user_id=user_id, sent_at=datetime.utcnow(),
                      local_date=today,            sms_count=10, click_count=4),
        MenuBroadcast(user_id=user_id, sent_at=datetime.utcnow(),
                      local_date=today - timedelta(days=2),
                      sms_count=8, click_count=2),
        MenuBroadcast(user_id=user_id, sent_at=datetime.utcnow(),
                      local_date=today - timedelta(days=6),
                      sms_count=5, click_count=1),
        # Outside window
        MenuBroadcast(user_id=user_id, sent_at=datetime.utcnow(),
                      local_date=today - timedelta(days=10),
                      sms_count=100, click_count=50),
    ]
    for r in rows:
        db_session.add(r)
    db_session.commit()

    # Two bookings stamped to in-window broadcasts; one to out-of-window
    db_session.refresh(rows[0])
    db_session.refresh(rows[3])
    db_session.add(Booking(user_id=user_id, customer_name="A", date=today,
                           time_slot="19:00", party_size=2, status="confirmed",
                           menu_broadcast_id=rows[0].id))
    db_session.add(Booking(user_id=user_id, customer_name="B", date=today,
                           time_slot="20:00", party_size=2, status="confirmed",
                           menu_broadcast_id=rows[0].id))
    db_session.add(Booking(user_id=user_id, customer_name="C", date=today,
                           time_slot="21:00", party_size=2, status="confirmed",
                           menu_broadcast_id=rows[3].id))
    db_session.commit()

    res = client.get("/api/restaurant/menu-broadcasts/stats", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["window_days"] == 7
    assert data["rounds"]   == 3            # 10-day-old row excluded
    assert data["sms_sent"] == 10 + 8 + 5   # = 23
    assert data["clicks"]   == 4 + 2 + 1    # = 7
    assert data["bookings"] == 2            # only the two attributed to in-window broadcast


def test_stats_endpoint_requires_restaurant_account(client, db_session):
    token, _ = register_user(client, email="consumer@example.com",
                             account_type="consumer")
    res = client.get("/api/restaurant/menu-broadcasts/stats",
                     headers=auth_headers(token))
    assert res.status_code == 403


def test_stats_empty_when_no_broadcasts(client, db_session):
    token, _ = register_user(client, email="empty@example.com",
                             account_type="restaurant")
    res = client.get("/api/restaurant/menu-broadcasts/stats",
                     headers=auth_headers(token))
    assert res.status_code == 200
    data = res.json()
    assert data == {"window_days": 7, "rounds": 0, "sms_sent": 0,
                    "clicks": 0, "bookings": 0}
