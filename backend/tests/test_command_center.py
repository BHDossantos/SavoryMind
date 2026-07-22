"""AI Command Center 'Good morning' hero — real yesterday actuals + honest gaps."""
from datetime import date, timedelta

from app.models.menu import MenuItem
from app.models.restaurant_ext import SalesLog, Booking
from app.models.user import User
from app.services import command_center_service

from .conftest import register_user, auth_headers


def _restaurant(client, db_session, email):
    token, user = register_user(client, email=email, account_type="restaurant")
    row = db_session.query(User).filter(User.id == user["id"]).first()
    row.onboarding_completed = True
    db_session.commit()
    return token, row


def test_yesterday_financials_from_sales_logs(client, db_session):
    token, owner = _restaurant(client, db_session, "cc1@example.com")
    db_session.add(MenuItem(user_id=owner.id, name="Carbonara", category="Mains",
                            price=14.0, cost=4.0))
    y = date.today() - timedelta(days=1)
    for _ in range(10):
        db_session.add(SalesLog(user_id=owner.id, item_name="Carbonara", quantity=1,
                                revenue=14.0, sale_date=y, hour_of_day=20, day_of_week=y.weekday()))
    db_session.commit()
    cc = command_center_service.build(db_session, owner)
    assert cc["yesterday"]["has_data"] is True
    assert cc["yesterday"]["revenue"] == 140.0
    assert cc["yesterday"]["profit"] == 100.0  # 140 rev − 40 cogs


def test_no_sales_is_honest_null_not_zero(client, db_session):
    token, owner = _restaurant(client, db_session, "cc2@example.com")
    # Purge any seeded sales for a clean assertion.
    db_session.query(SalesLog).filter(SalesLog.user_id == owner.id).delete()
    db_session.commit()
    cc = command_center_service.build(db_session, owner)
    assert cc["yesterday"]["has_data"] is False
    assert cc["yesterday"]["revenue"] is None


def test_reservations_today_counted(client, db_session):
    token, owner = _restaurant(client, db_session, "cc3@example.com")
    today = date.today()
    db_session.add_all([
        Booking(user_id=owner.id, customer_name="A", date=today, time_slot="20:00",
                party_size=2, status="confirmed"),
        Booking(user_id=owner.id, customer_name="B", date=today, time_slot="21:00",
                party_size=4, status="pending"),
    ])
    db_session.commit()
    cc = command_center_service.build(db_session, owner)
    assert cc["reservations_today"] >= 2
    assert cc["covers_today"] >= 2  # confirmed covers


def test_greeting_and_shape(client, db_session):
    token, owner = _restaurant(client, db_session, "cc4@example.com")
    cc = command_center_service.build(db_session, owner)
    assert cc["greeting"] in ("Buongiorno", "Buon pomeriggio", "Buonasera")
    for key in ("yesterday", "rating", "reservations_today", "busy_hours",
                "predicted_revenue_today", "inventory_alerts", "staff_shortages",
                "recommendations", "top_actions"):
        assert key in cc


def test_command_center_endpoint(client, db_session):
    token, _ = _restaurant(client, db_session, "cc5@example.com")
    res = client.get("/api/restaurant/command-center", headers=auth_headers(token))
    assert res.status_code == 200
    assert "greeting" in res.json()


def test_command_center_requires_restaurant(client):
    token, _ = register_user(client, email="cc-consumer@example.com", account_type="consumer")
    assert client.get("/api/restaurant/command-center", headers=auth_headers(token)).status_code == 403
