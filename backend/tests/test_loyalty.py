"""Tests for Loyalty rewards + redemption (Restaurant OS Wave C)."""
from datetime import datetime

from app.models.restaurant_ext import CRMCustomer, LoyaltyRedemption
from app.models.user import User
from app.services import loyalty_service

from .conftest import register_user, auth_headers


def _restaurant(db, **kw):
    defaults = dict(
        email=f"r{datetime.now().timestamp()}@example.com",
        password_hash="x", display_name="Trattoria L",
        restaurant_name="Trattoria L", account_type="restaurant",
        onboarding_completed=True,
    )
    defaults.update(kw)
    u = User(**defaults)
    db.add(u); db.commit(); db.refresh(u)
    return u


def _customer(db, user_id, points=0, **kw):
    c = CRMCustomer(user_id=user_id, name="Guest", loyalty_points=points, **kw)
    db.add(c); db.commit(); db.refresh(c)
    return c


def test_create_and_list_reward(db_session):
    rest = _restaurant(db_session)
    r = loyalty_service.create_reward(db_session, rest.id, name="Free dessert", points_cost=500)
    assert r.id
    rewards = loyalty_service.list_rewards(db_session, rest.id)
    assert len(rewards) == 1
    assert rewards[0].points_cost == 500


def test_create_reward_validation(db_session):
    rest = _restaurant(db_session)
    try:
        loyalty_service.create_reward(db_session, rest.id, name="", points_cost=100)
        assert False, "expected LoyaltyError"
    except loyalty_service.LoyaltyError:
        pass
    try:
        loyalty_service.create_reward(db_session, rest.id, name="X", points_cost=0)
        assert False, "expected LoyaltyError"
    except loyalty_service.LoyaltyError:
        pass


def test_redeem_deducts_points_and_logs(db_session):
    rest = _restaurant(db_session)
    c = _customer(db_session, rest.id, points=600, loyalty_tier="silver")
    r = loyalty_service.create_reward(db_session, rest.id, name="Free dessert", points_cost=500)
    result = loyalty_service.redeem(db_session, rest.id, c.id, r.id)
    assert result["points_spent"] == 500
    assert result["remaining_points"] == 100
    db_session.refresh(c)
    assert c.loyalty_points == 100
    # tier re-derived downward
    assert c.loyalty_tier == "bronze"
    logs = db_session.query(LoyaltyRedemption).filter_by(customer_id=c.id).all()
    assert len(logs) == 1
    assert logs[0].reward_name == "Free dessert"


def test_redeem_insufficient_points(db_session):
    rest = _restaurant(db_session)
    c = _customer(db_session, rest.id, points=100)
    r = loyalty_service.create_reward(db_session, rest.id, name="Big reward", points_cost=1000)
    try:
        loyalty_service.redeem(db_session, rest.id, c.id, r.id)
        assert False, "expected LoyaltyError"
    except loyalty_service.LoyaltyError as e:
        assert "Not enough" in str(e)
    db_session.refresh(c)
    assert c.loyalty_points == 100  # unchanged


def test_redeem_inactive_reward(db_session):
    rest = _restaurant(db_session)
    c = _customer(db_session, rest.id, points=1000)
    r = loyalty_service.create_reward(db_session, rest.id, name="X", points_cost=100)
    loyalty_service.update_reward(db_session, rest.id, r.id, active=False)
    try:
        loyalty_service.redeem(db_session, rest.id, c.id, r.id)
        assert False, "expected LoyaltyError"
    except loyalty_service.LoyaltyError:
        pass


def test_affordable_flags(db_session):
    rest = _restaurant(db_session)
    c = _customer(db_session, rest.id, points=600)
    loyalty_service.create_reward(db_session, rest.id, name="Cheap", points_cost=500)
    loyalty_service.create_reward(db_session, rest.id, name="Pricey", points_cost=1000)
    out = loyalty_service.affordable_for_customer(db_session, rest.id, c.id)
    by_name = {r["name"]: r for r in out["rewards"]}
    assert by_name["Cheap"]["affordable"] is True
    assert by_name["Pricey"]["affordable"] is False


# --- Endpoint tests ---

def test_reward_crud_endpoints(client, db_session):
    token, _ = register_user(client, email="loyrest@example.com", account_type="restaurant")
    h = auth_headers(token)
    res = client.post("/api/restaurant/loyalty/rewards", headers=h,
                      json={"name": "Free coffee", "points_cost": 200})
    assert res.status_code == 201
    rid = res.json()["id"]
    res = client.get("/api/restaurant/loyalty/rewards", headers=h)
    assert len(res.json()) == 1
    res = client.patch(f"/api/restaurant/loyalty/rewards/{rid}", headers=h,
                       json={"points_cost": 250})
    assert res.json()["points_cost"] == 250
    res = client.delete(f"/api/restaurant/loyalty/rewards/{rid}", headers=h)
    assert res.status_code == 204


def test_redeem_endpoint(client, db_session):
    token, user = register_user(client, email="loyredeem@example.com", account_type="restaurant")
    h = auth_headers(token)
    c = _customer(db_session, user["id"], points=600)
    r = loyalty_service.create_reward(db_session, user["id"], name="Free dessert", points_cost=500)
    res = client.post(f"/api/restaurant/loyalty/customers/{c.id}/redeem", headers=h,
                      json={"reward_id": r.id})
    assert res.status_code == 200, res.text
    assert res.json()["remaining_points"] == 100


def test_redeem_endpoint_insufficient(client, db_session):
    token, user = register_user(client, email="loyredeem2@example.com", account_type="restaurant")
    h = auth_headers(token)
    c = _customer(db_session, user["id"], points=50)
    r = loyalty_service.create_reward(db_session, user["id"], name="X", points_cost=500)
    res = client.post(f"/api/restaurant/loyalty/customers/{c.id}/redeem", headers=h,
                      json={"reward_id": r.id})
    assert res.status_code == 400


def test_loyalty_requires_restaurant(client, db_session):
    token, _ = register_user(client, email="loycons@example.com", account_type="consumer")
    res = client.get("/api/restaurant/loyalty/rewards", headers=auth_headers(token))
    assert res.status_code == 403
