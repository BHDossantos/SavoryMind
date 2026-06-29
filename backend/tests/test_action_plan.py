"""Tests for the restaurant Today's AI Action Plan service.

Pins the contract: the action plan turns existing signals (menu
recommendations, food waste, menu broadcast, bookings) into a short
list of ranked, render-ready cards. Each card carries the cta_route
the frontend needs to one-click into the action.
"""
from datetime import date, datetime, timedelta

from app.models.menu import MenuItem
from app.models.restaurant_ext import Booking, MenuBroadcast
from app.models.user import User
from app.services import action_plan_service

from .conftest import register_user, auth_headers


def _make_restaurant(db, **kwargs):
    defaults = dict(
        email=f"r{datetime.now().timestamp()}@example.com",
        password_hash="x",
        display_name="Trattoria AP",
        restaurant_name="Trattoria AP",
        account_type="restaurant",
        onboarding_completed=True,
        timezone="Europe/Rome",
    )
    defaults.update(kwargs)
    u = User(**defaults)
    db.add(u); db.commit(); db.refresh(u)
    return u


def test_empty_calendar_action_when_no_bookings(client, db_session):
    rest = _make_restaurant(db_session)
    plan = action_plan_service.build_action_plan(db_session, rest)
    kinds = [a["kind"] for a in plan]
    assert "empty_calendar" in kinds
    # menu_publish fires too because there's no menu
    assert "menu_publish" in kinds


def test_publish_menu_action_when_menu_blank(client, db_session):
    rest = _make_restaurant(db_session, menu_of_the_day=None)
    plan = action_plan_service.build_action_plan(db_session, rest)
    menu = next((a for a in plan if a["kind"] == "menu_publish"), None)
    assert menu is not None
    assert menu["cta_route"] == "/restaurant/bookings"


def test_broadcast_wins_action_after_attribution(client, db_session):
    rest = _make_restaurant(db_session, menu_of_the_day="Pasta — €14")
    today = date.today()
    b = MenuBroadcast(
        user_id=rest.id, sent_at=datetime.utcnow(), local_date=today,
        sms_count=20, click_count=5,
    )
    db_session.add(b); db_session.commit(); db_session.refresh(b)
    db_session.add(Booking(
        user_id=rest.id, customer_name="A", date=today, time_slot="19:00",
        party_size=2, status="confirmed", menu_broadcast_id=b.id,
    ))
    db_session.commit()
    rest.menu_sms_last_sent_date = today
    db_session.commit()

    plan = action_plan_service.build_action_plan(db_session, rest)
    wins = next((a for a in plan if a["kind"] == "broadcast_wins"), None)
    assert wins is not None
    assert "1 booking" in wins["title"]


def test_tonight_covers_when_bookings_today(client, db_session):
    rest = _make_restaurant(db_session)
    today = date.today()
    db_session.add(Booking(
        user_id=rest.id, customer_name="A", date=today, time_slot="19:00",
        party_size=4, status="confirmed",
    ))
    db_session.commit()
    plan = action_plan_service.build_action_plan(db_session, rest)
    tonight = next((a for a in plan if a["kind"] == "tonight_covers"), None)
    assert tonight is not None
    assert "4 covers" in tonight["title"]


def test_high_priority_menu_recommendation_surfaces(client, db_session):
    """Items in the existing recommendation engine with priority=high
    should appear at the top of the action plan."""
    rest = _make_restaurant(db_session)
    db_session.add(MenuItem(
        user_id=rest.id, name="Underpriced Burger", category="mains",
        # margin = 20%, orders > 50 → triggers price_increase (high priority)
        price=10.0, cost=8.0, orders_last_30_days=120, rating=4.5,
    ))
    db_session.commit()
    plan = action_plan_service.build_action_plan(db_session, rest)
    pr = next((a for a in plan if a["kind"] == "price_increase"), None)
    assert pr is not None
    assert pr["severity"] == "high"
    assert pr["estimated_gain"] > 0


def test_action_plan_endpoint_returns_actions(client, db_session):
    token, _ = register_user(client, email="apop@example.com", account_type="restaurant")
    res = client.get("/api/restaurant/action-plan", headers=auth_headers(token))
    assert res.status_code == 200
    data = res.json()
    assert "actions" in data
    assert isinstance(data["actions"], list)


def test_action_plan_requires_restaurant_account(client, db_session):
    token, _ = register_user(client, email="apcons@example.com", account_type="consumer")
    res = client.get("/api/restaurant/action-plan", headers=auth_headers(token))
    assert res.status_code == 403


def test_action_plan_caps_at_five(client, db_session):
    """Even when many signals fire, the operator only sees 5 — anything
    more is noise."""
    rest = _make_restaurant(db_session, menu_of_the_day=None)
    # Many high-priority menu items
    for i in range(6):
        db_session.add(MenuItem(
            user_id=rest.id, name=f"Item{i}", category="mains",
            price=10.0, cost=4.0, orders_last_30_days=120, rating=2.5,  # low-rating trigger
        ))
    db_session.commit()
    plan = action_plan_service.build_action_plan(db_session, rest)
    assert len(plan) <= 5


def test_severity_sort_order(client, db_session):
    """High severity should come before low."""
    rest = _make_restaurant(db_session, menu_of_the_day="Pasta — €14")
    today = date.today()
    # Add an item that triggers a high-severity quality_review
    db_session.add(MenuItem(
        user_id=rest.id, name="Bad Dish", category="mains",
        price=15.0, cost=6.0, orders_last_30_days=40, rating=2.0,
    ))
    # And add bookings tonight (low-severity celebration)
    db_session.add(Booking(
        user_id=rest.id, customer_name="A", date=today, time_slot="19:00",
        party_size=2, status="confirmed",
    ))
    rest.menu_sms_last_sent_date = today
    db_session.commit()
    plan = action_plan_service.build_action_plan(db_session, rest)
    # Find a high-severity item and a low-severity item; high comes first
    severities = [a["severity"] for a in plan]
    high_idx = next((i for i, s in enumerate(severities) if s == "high"), None)
    low_idx = next((i for i, s in enumerate(severities) if s == "low"), None)
    if high_idx is not None and low_idx is not None:
        assert high_idx < low_idx
