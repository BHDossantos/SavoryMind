"""Tests for consumer-side saved restaurants (favorites)."""
from datetime import datetime

from app.models.user import User

from .conftest import register_user, auth_headers


def _make_restaurant(db):
    u = User(
        email=f"r{datetime.now().timestamp()}@example.com",
        password_hash="x",
        display_name="Trattoria S",
        restaurant_name="Trattoria S",
        account_type="restaurant",
        onboarding_completed=True,
        slug="trat-s",
    )
    db.add(u); db.commit(); db.refresh(u)
    return u


def test_save_and_list(client, db_session):
    rest = _make_restaurant(db_session)
    token, _ = register_user(client, email="csav@example.com", account_type="consumer")
    res = client.post(
        f"/api/consumer/saved-restaurants/{rest.id}", headers=auth_headers(token),
    )
    assert res.status_code == 201
    assert res.json()["restaurant_id"] == rest.id

    res = client.get("/api/consumer/saved-restaurants", headers=auth_headers(token))
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["restaurant_name"] == "Trattoria S"


def test_save_idempotent(client, db_session):
    rest = _make_restaurant(db_session)
    token, _ = register_user(client, email="csav2@example.com", account_type="consumer")
    a = client.post(f"/api/consumer/saved-restaurants/{rest.id}", headers=auth_headers(token))
    b = client.post(f"/api/consumer/saved-restaurants/{rest.id}", headers=auth_headers(token))
    assert b.status_code == 201
    assert b.json()["already_saved"] is True
    listing = client.get("/api/consumer/saved-restaurants", headers=auth_headers(token)).json()
    assert len(listing) == 1


def test_unsave(client, db_session):
    rest = _make_restaurant(db_session)
    token, _ = register_user(client, email="csav3@example.com", account_type="consumer")
    client.post(f"/api/consumer/saved-restaurants/{rest.id}", headers=auth_headers(token))
    res = client.delete(f"/api/consumer/saved-restaurants/{rest.id}", headers=auth_headers(token))
    assert res.status_code == 204
    listing = client.get("/api/consumer/saved-restaurants", headers=auth_headers(token)).json()
    assert listing == []


def test_save_404_unknown_restaurant(client, db_session):
    token, _ = register_user(client, email="csav4@example.com", account_type="consumer")
    res = client.post("/api/consumer/saved-restaurants/99999", headers=auth_headers(token))
    assert res.status_code == 404


def test_save_404_non_restaurant_user(client, db_session):
    token1, u1 = register_user(client, email="c1sav@example.com", account_type="consumer")
    token2, u2 = register_user(client, email="c2sav@example.com", account_type="consumer")
    res = client.post(
        f"/api/consumer/saved-restaurants/{u2['id']}", headers=auth_headers(token1),
    )
    # Trying to save a non-restaurant user must 404 (treated as "not a restaurant").
    assert res.status_code == 404
