"""Tests for /api/public/restaurants/{slug} — the no-auth booking surface
behind savorymind.net/r/{slug}.

Pins the contract restaurants will pitch to their diners: link works
without an account, instant confirm when there's room, pending when
there isn't, restaurant gets notified by every channel they've opted
into, and 404s are returned consistently for unknown / not-yet-onboarded
slugs.
"""
from datetime import date, timedelta
from unittest.mock import patch

from .conftest import register_user, auth_headers


def _onboard_restaurant(client, db_session, *, name="Trattoria Test", phone=None):
    """Sign up a restaurant, complete onboarding so its slug is generated,
    return (user_id, slug, headers)."""
    token, _ = register_user(client, email="owner@example.com", account_type="restaurant")
    headers = auth_headers(token)
    profile = {
        "display_name":       "Owner",
        "first_name":         "Marco",
        "last_name":          "Rossi",
        "restaurant_name":    name,
        "city":               "Roma",
        "country":            "Italy",
        "seating_capacity":   40,
        "onboarding_completed": True,
    }
    if phone:
        profile["phone"] = phone
    res = client.patch("/api/auth/profile", json=profile, headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    return body["id"], body["slug"], headers


def test_slug_auto_generated_from_restaurant_name(client, db_session):
    _user_id, slug, _ = _onboard_restaurant(client, db_session, name="L'Osteria del Borgo")
    # Italian accents/apostrophes get stripped, spaces become hyphens.
    assert slug == "losteria-del-borgo"


def test_get_public_restaurant_returns_info_and_availability(client, db_session):
    _user_id, slug, _ = _onboard_restaurant(client, db_session)
    res = client.get(f"/api/public/restaurants/{slug}")
    assert res.status_code == 200
    data = res.json()
    assert data["restaurant"]["slug"] == slug
    assert data["restaurant"]["restaurant_name"] == "Trattoria Test"
    assert data["restaurant"]["city"] == "Roma"
    # 14 days of availability — first day is today
    assert len(data["upcoming"]) == 14
    assert data["upcoming"][0]["date"] == str(date.today())
    # Default slot list is non-empty
    assert len(data["upcoming"][0]["slots"]) > 0


def test_get_public_restaurant_404_unknown_slug(client, db_session):
    res = client.get("/api/public/restaurants/does-not-exist")
    assert res.status_code == 404


def test_get_public_restaurant_404_when_not_onboarded(client, db_session):
    """A restaurant that signed up but hasn't finished onboarding shouldn't
    be publicly bookable yet."""
    token, _ = register_user(client, email="halfway@example.com", account_type="restaurant")
    headers = auth_headers(token)
    # Set a name + slug-generating field but leave onboarding_completed off
    client.patch("/api/auth/profile", json={
        "display_name":    "Halfway",
        "restaurant_name": "Halfway Cafe",
        "city":            "Roma",
    }, headers=headers)
    # Slug was generated but the public route should still 404
    me = client.get("/api/auth/me", headers=headers).json()
    assert me["slug"] is not None
    res = client.get(f"/api/public/restaurants/{me['slug']}")
    assert res.status_code == 404


def test_guest_booking_confirms_instantly_when_slot_has_room(client, db_session):
    _user_id, slug, _ = _onboard_restaurant(client, db_session)
    tomorrow = str(date.today() + timedelta(days=1))
    with patch("app.api.routes.public_booking.resend_client.send_email") as send_email, \
         patch("app.api.routes.public_booking.twilio_client.send_sms") as send_sms:
        res = client.post(
            f"/api/public/restaurants/{slug}/book",
            json={
                "booking_date":   tomorrow,
                "booking_time":   "19:00",
                "party_size":     4,
                "customer_name":  "Alessia Bianchi",
                "customer_phone": "+393334445566",
            },
        )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "confirmed"
    assert body["booking_id"] > 0
    # Email send was attempted (resend itself is mocked, so no real send)
    assert send_email.called


def test_guest_booking_returns_pending_when_slot_is_full(client, db_session):
    _user_id, slug, headers = _onboard_restaurant(client, db_session)
    # Constrain capacity to 2 so a party of 4 can't fit
    client.patch("/api/auth/profile", json={"seating_capacity": 2}, headers=headers)
    tomorrow = str(date.today() + timedelta(days=1))
    res = client.post(
        f"/api/public/restaurants/{slug}/book",
        json={
            "booking_date":   tomorrow,
            "booking_time":   "19:00",
            "party_size":     4,
            "customer_name":  "Big Group",
            "customer_phone": "+393334445566",
        },
    )
    assert res.status_code == 201
    assert res.json()["status"] == "pending"


def test_guest_booking_rejects_invalid_date(client, db_session):
    _user_id, slug, _ = _onboard_restaurant(client, db_session)
    res = client.post(
        f"/api/public/restaurants/{slug}/book",
        json={
            "booking_date":   "not-a-date",
            "booking_time":   "19:00",
            "party_size":     2,
            "customer_name":  "Test",
            "customer_phone": "+393334445566",
        },
    )
    assert res.status_code == 400


def test_guest_booking_sends_sms_when_restaurant_has_phone(client, db_session):
    _user_id, slug, _ = _onboard_restaurant(client, db_session, phone="+393334445566")
    tomorrow = str(date.today() + timedelta(days=1))
    with patch("app.api.routes.public_booking.twilio_client.send_sms") as send_sms:
        client.post(
            f"/api/public/restaurants/{slug}/book",
            json={
                "booking_date":   tomorrow,
                "booking_time":   "19:00",
                "party_size":     2,
                "customer_name":  "Alessia",
                "customer_phone": "+393334445566",
            },
        )
    assert send_sms.called
    to_phone, sms_body = send_sms.call_args.args
    assert to_phone == "+393334445566"
    assert "Alessia" in sms_body


def test_guest_booking_skips_sms_when_restaurant_has_no_phone(client, db_session):
    _user_id, slug, _ = _onboard_restaurant(client, db_session)  # no phone
    tomorrow = str(date.today() + timedelta(days=1))
    with patch("app.api.routes.public_booking.twilio_client.send_sms") as send_sms:
        client.post(
            f"/api/public/restaurants/{slug}/book",
            json={
                "booking_date":   tomorrow,
                "booking_time":   "19:00",
                "party_size":     2,
                "customer_name":  "Test",
                "customer_phone": "+393334445566",
            },
        )
    assert not send_sms.called
