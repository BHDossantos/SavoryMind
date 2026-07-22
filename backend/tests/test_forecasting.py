"""Tomorrow forecasts — reservations (M11) + inventory usage velocity (M4)."""
from datetime import date, datetime, timedelta

from app.models.restaurant_ext import Booking, SalesLog
from app.models.inventory import InventoryItem, InventoryAdjustment
from app.models.user import User
from app.services import forecasting_service

from .conftest import register_user, auth_headers


def _restaurant(client, db_session, email):
    token, user = register_user(client, email=email, account_type="restaurant")
    row = db_session.query(User).filter(User.id == user["id"]).first()
    row.onboarding_completed = True
    db_session.commit()
    return token, row


# ── Reservations ──────────────────────────────────────────────────────────────

def test_reservations_forecast_from_same_weekday(client, db_session):
    token, owner = _restaurant(client, db_session, "fc1@example.com")
    db_session.query(Booking).filter(Booking.user_id == owner.id).delete()
    db_session.commit()
    tomorrow = date.today() + timedelta(days=1)
    # Seed the last 4 matching-weekday service days, 5 bookings of 2 covers each.
    for w in range(1, 5):
        d = tomorrow - timedelta(days=7 * w)
        for _ in range(5):
            db_session.add(Booking(user_id=owner.id, customer_name="X", date=d,
                                   time_slot="20:00", party_size=2, status="confirmed",
                                   source="online"))
    db_session.commit()
    fc = forecasting_service.reservations_forecast(db_session, owner.id)
    assert fc["has_data"] is True
    assert fc["predicted_reservations"] == 5
    assert fc["predicted_covers"] == 10
    assert fc["confidence"] == "medium"  # 4 days of history


def test_reservations_forecast_no_history(client, db_session):
    token, owner = _restaurant(client, db_session, "fc2@example.com")
    db_session.query(Booking).filter(Booking.user_id == owner.id).delete()
    db_session.commit()
    fc = forecasting_service.reservations_forecast(db_session, owner.id)
    assert fc["has_data"] is False
    assert fc["predicted_reservations"] is None


def test_reservations_expected_revenue_uses_avg_ticket(client, db_session):
    token, owner = _restaurant(client, db_session, "fc3@example.com")
    tomorrow = date.today() + timedelta(days=1)
    for w in range(1, 4):
        d = tomorrow - timedelta(days=7 * w)
        db_session.add(Booking(user_id=owner.id, customer_name="X", date=d,
                               time_slot="20:00", party_size=4, status="confirmed",
                               source="online"))
    # Avg ticket €25 from 30d sales.
    db_session.add(SalesLog(user_id=owner.id, item_name="Dish", quantity=4, revenue=100.0,
                            sale_date=date.today(), hour_of_day=20, day_of_week=1))
    db_session.commit()
    fc = forecasting_service.reservations_forecast(db_session, owner.id)
    assert fc["expected_revenue"] is not None
    assert fc["expected_revenue"] > 0


# ── Inventory ─────────────────────────────────────────────────────────────────

def test_inventory_forecast_usage_velocity(client, db_session):
    token, owner = _restaurant(client, db_session, "fc4@example.com")
    item = InventoryItem(user_id=owner.id, name="Chicken", category="food", unit="kg",
                         par_level=10.0)
    db_session.add(item); db_session.commit(); db_session.refresh(item)
    # Delivery of 56kg, then 28kg used over the window → ~1kg/day, ~28kg left.
    db_session.add(InventoryAdjustment(item_id=item.id, user_id=owner.id,
                                       adjustment_type="delivery", delta=56.0,
                                       created_at=datetime.utcnow() - timedelta(days=27)))
    db_session.add(InventoryAdjustment(item_id=item.id, user_id=owner.id,
                                       adjustment_type="usage", delta=-28.0,
                                       created_at=datetime.utcnow() - timedelta(days=1)))
    db_session.commit()
    fc = forecasting_service.inventory_forecast(db_session, owner.id)
    assert fc["has_data"] is True
    chicken = next(i for i in fc["items"] if i["name"] == "Chicken")
    assert chicken["on_hand"] == 28.0
    assert chicken["daily_use"] == 1.0
    assert chicken["days_until_stockout"] == 28.0


def test_inventory_reorder_flag_when_low(client, db_session):
    token, owner = _restaurant(client, db_session, "fc5@example.com")
    item = InventoryItem(user_id=owner.id, name="Wine", category="alcohol", unit="bottle",
                         par_level=20.0)
    db_session.add(item); db_session.commit(); db_session.refresh(item)
    # On hand 5, below par 20 → reorder_now.
    db_session.add(InventoryAdjustment(item_id=item.id, user_id=owner.id,
                                       adjustment_type="delivery", delta=5.0,
                                       created_at=datetime.utcnow() - timedelta(days=2)))
    db_session.commit()
    fc = forecasting_service.inventory_forecast(db_session, owner.id)
    wine = next(i for i in fc["items"] if i["name"] == "Wine")
    assert wine["reorder_now"] is True
    assert any(r["name"] == "Wine" for r in fc["reorder_soon"])


# ── Endpoints ─────────────────────────────────────────────────────────────────

def test_forecast_endpoints(client, db_session):
    token, _ = _restaurant(client, db_session, "fc6@example.com")
    assert client.get("/api/restaurant/forecast/reservations", headers=auth_headers(token)).status_code == 200
    assert client.get("/api/restaurant/forecast/inventory", headers=auth_headers(token)).status_code == 200


def test_forecast_requires_restaurant(client):
    token, _ = register_user(client, email="fc-consumer@example.com", account_type="consumer")
    assert client.get("/api/restaurant/forecast/reservations", headers=auth_headers(token)).status_code == 403
