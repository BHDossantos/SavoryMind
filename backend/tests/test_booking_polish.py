"""Tests for booking polish: ICS file, repeat-customer count, customer_notes."""
from datetime import date, timedelta

from app.models.restaurant_ext import Booking
from app.models.user import User
from app.services import booking_extras

from .conftest import register_user, auth_headers


def _onboard_restaurant(client, email="ownerpolish@example.com"):
    token, _ = register_user(client, email=email, account_type="restaurant")
    headers = auth_headers(token)
    res = client.patch("/api/auth/profile", json={
        "display_name": "Owner",
        "restaurant_name": "Trattoria P",
        "city": "Roma",
        "country": "Italy",
        "onboarding_completed": True,
    }, headers=headers)
    return res.json()["id"], res.json()["slug"], headers


def test_ics_endpoint_returns_calendar_file(client, db_session):
    user_id, slug, _ = _onboard_restaurant(client)
    b = Booking(user_id=user_id, customer_name="Marco",
                customer_phone="+393334445566",
                date=date.today() + timedelta(days=3),
                time_slot="20:00", party_size=2, status="confirmed")
    db_session.add(b); db_session.commit(); db_session.refresh(b)
    res = client.get(f"/api/public/restaurants/bookings/{b.id}/ics")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/calendar")
    assert "BEGIN:VCALENDAR" in res.text
    assert "BEGIN:VEVENT" in res.text
    assert "Trattoria P" in res.text


def test_ics_404_on_unknown_booking(client, db_session):
    res = client.get("/api/public/restaurants/bookings/99999/ics")
    assert res.status_code == 404


def test_repeat_visits_count_matches_by_phone(client, db_session):
    user_id, _, _ = _onboard_restaurant(client, email="ownrep@example.com")
    # Three past completed bookings from the same phone
    for d in [date.today() - timedelta(days=30), date.today() - timedelta(days=60),
              date.today() - timedelta(days=90)]:
        db_session.add(Booking(
            user_id=user_id, customer_name="Marco", customer_phone="+39111",
            date=d, time_slot="20:00", party_size=2, status="completed",
        ))
    db_session.commit()
    count = booking_extras.repeat_visits_count(
        db_session, user_id=user_id, phone="+39111", email=None,
    )
    assert count == 3


def test_repeat_visits_excludes_cancelled(client, db_session):
    user_id, _, _ = _onboard_restaurant(client, email="ownrep2@example.com")
    db_session.add(Booking(
        user_id=user_id, customer_name="A", customer_phone="+39222",
        date=date.today() - timedelta(days=10), time_slot="19:00",
        party_size=2, status="cancelled",
    ))
    db_session.commit()
    count = booking_extras.repeat_visits_count(
        db_session, user_id=user_id, phone="+39222", email=None,
    )
    assert count == 0


def test_booking_list_stamps_repeat_count(client, db_session):
    user_id, _, headers = _onboard_restaurant(client, email="ownrep3@example.com")
    # Two past bookings + one upcoming for same diner
    db_session.add(Booking(
        user_id=user_id, customer_name="Marco", customer_phone="+39333",
        date=date.today() - timedelta(days=20), time_slot="19:00",
        party_size=2, status="completed",
    ))
    db_session.add(Booking(
        user_id=user_id, customer_name="Marco", customer_phone="+39333",
        date=date.today() + timedelta(days=2), time_slot="19:00",
        party_size=2, status="confirmed",
    ))
    db_session.commit()
    res = client.get("/api/restaurant/bookings", headers=headers)
    assert res.status_code == 200
    by_date = {b["date"]: b for b in res.json()}
    future = by_date[str(date.today() + timedelta(days=2))]
    # Future booking is their 2nd visit → repeat_visits should be 1
    assert future["repeat_visits"] == 1


def test_customer_notes_update(client, db_session):
    user_id, _, headers = _onboard_restaurant(client, email="ownnotes@example.com")
    b = Booking(user_id=user_id, customer_name="Marco",
                date=date.today() + timedelta(days=2),
                time_slot="19:00", party_size=2, status="confirmed")
    db_session.add(b); db_session.commit(); db_session.refresh(b)
    res = client.patch(
        f"/api/restaurant/bookings/{b.id}",
        headers=headers,
        json={"customer_notes": "Allergic to shellfish. VIP."},
    )
    assert res.status_code == 200, res.text
    assert res.json()["customer_notes"] == "Allergic to shellfish. VIP."
