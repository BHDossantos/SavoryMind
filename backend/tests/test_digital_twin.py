"""Digital Twin — unified snapshot fusing all engines, honest & traceable."""
from datetime import date, timedelta

from app.models.menu import MenuItem
from app.models.restaurant_ext import SalesLog, Booking
from app.models.user import User
from app.services import digital_twin_service

from .conftest import register_user, auth_headers


def _restaurant(client, db_session, email):
    token, user = register_user(client, email=email, account_type="restaurant")
    row = db_session.query(User).filter(User.id == user["id"]).first()
    row.onboarding_completed = True
    db_session.commit()
    return token, row


def test_snapshot_answers_five_questions(client, db_session):
    token, owner = _restaurant(client, db_session, "dt1@example.com")
    snap = digital_twin_service.snapshot(db_session, owner)
    for key in ("headline", "what_happened", "why", "tomorrow", "today_actions", "health"):
        assert key in snap
    assert "drivers" in snap["why"]
    assert "overall" in snap["health"]


def test_why_drivers_reference_real_yesterday_sales(client, db_session):
    token, owner = _restaurant(client, db_session, "dt2@example.com")
    db_session.query(SalesLog).filter(SalesLog.user_id == owner.id).delete()
    db_session.add(MenuItem(user_id=owner.id, name="Carbonara", category="Mains", price=14, cost=4))
    y = date.today() - timedelta(days=1)
    for _ in range(12):
        db_session.add(SalesLog(user_id=owner.id, item_name="Carbonara", quantity=1,
                                revenue=14.0, sale_date=y, hour_of_day=20, day_of_week=y.weekday()))
    db_session.commit()
    snap = digital_twin_service.snapshot(db_session, owner)
    assert snap["what_happened"]["has_data"] is True
    assert snap["what_happened"]["revenue"] == 168.0
    # A driver must mention the real top seller.
    assert any("Carbonara" in d for d in snap["why"]["drivers"])


def test_headline_honest_when_no_yesterday_data(client, db_session):
    token, owner = _restaurant(client, db_session, "dt3@example.com")
    db_session.query(SalesLog).filter(SalesLog.user_id == owner.id).delete()
    db_session.commit()
    snap = digital_twin_service.snapshot(db_session, owner)
    assert snap["what_happened"]["has_data"] is False
    assert "non ci sono" in snap["headline"].lower()


def test_tomorrow_includes_reservation_forecast(client, db_session):
    token, owner = _restaurant(client, db_session, "dt4@example.com")
    tomorrow = date.today() + timedelta(days=1)
    for w in range(1, 4):
        d = tomorrow - timedelta(days=7 * w)
        db_session.add(Booking(user_id=owner.id, customer_name="X", date=d, time_slot="20:00",
                               party_size=2, status="confirmed", source="online"))
    db_session.commit()
    snap = digital_twin_service.snapshot(db_session, owner)
    assert "reservations" in snap["tomorrow"]
    assert snap["tomorrow"]["reservations"]["has_data"] is True


def test_digital_twin_endpoint(client, db_session):
    token, _ = _restaurant(client, db_session, "dt5@example.com")
    res = client.get("/api/restaurant/digital-twin", headers=auth_headers(token))
    assert res.status_code == 200
    assert "headline" in res.json()


def test_digital_twin_requires_restaurant(client):
    token, _ = register_user(client, email="dt-consumer@example.com", account_type="consumer")
    assert client.get("/api/restaurant/digital-twin", headers=auth_headers(token)).status_code == 403
