"""Tests for the Square POS integration.

The Square HTTP layer (_http_get / _http_post) is monkeypatched so we
exercise OAuth state + the full catalog/orders sync pipeline without a
live Square account.
"""
from datetime import datetime, timedelta
from unittest.mock import patch

from app.models.menu import MenuItem
from app.models.pos import POSConnection
from app.models.restaurant_ext import SalesLog
from app.models.user import User
from app.services import square_pos_service as sq

from .conftest import register_user, auth_headers


def _restaurant(db, **kw):
    defaults = dict(
        email=f"r{datetime.now().timestamp()}@example.com",
        password_hash="x", display_name="Trattoria POS",
        restaurant_name="Trattoria POS", account_type="restaurant",
        onboarding_completed=True,
    )
    defaults.update(kw)
    u = User(**defaults)
    db.add(u); db.commit(); db.refresh(u)
    return u


def _connect(db, user_id):
    c = POSConnection(user_id=user_id, provider="square", connected=True,
                      access_token="tok", merchant_id="M1")
    db.add(c); db.commit(); db.refresh(c)
    return c


def test_state_round_trip(monkeypatch):
    monkeypatch.setattr(sq.settings, "square_app_id", "app")
    monkeypatch.setattr(sq.settings, "square_app_secret", "secret")
    token = sq._sign_state(42)
    assert sq.verify_state(token) == 42


def test_state_rejects_wrong_type():
    import jwt
    bad = jwt.encode({"sub": "1", "typ": "other",
                      "exp": datetime.utcnow() + timedelta(minutes=5)},
                     sq.settings.secret_key, algorithm="HS256")
    try:
        sq.verify_state(bad)
        assert False
    except ValueError:
        pass


def test_is_configured(monkeypatch):
    monkeypatch.setattr(sq.settings, "square_app_id", "")
    assert sq.is_configured() is False
    monkeypatch.setattr(sq.settings, "square_app_id", "app")
    monkeypatch.setattr(sq.settings, "square_app_secret", "s")
    assert sq.is_configured() is True


# Fake Square API responses -------------------------------------------------

_CATALOG = {
    "objects": [
        {"type": "ITEM", "item_data": {
            "name": "Margherita Pizza",
            "variations": [{"item_variation_data": {"price_money": {"amount": 1200, "currency": "EUR"}}}],
        }},
        {"type": "ITEM", "item_data": {
            "name": "Tiramisu",
            "variations": [{"item_variation_data": {"price_money": {"amount": 600, "currency": "EUR"}}}],
        }},
    ]
}

_now = datetime.utcnow()
_ORDERS = {
    "orders": [
        {"closed_at": _now.isoformat() + "Z", "line_items": [
            {"name": "Margherita Pizza", "quantity": "3", "gross_sales_money": {"amount": 3600}},
            {"name": "Tiramisu", "quantity": "2", "gross_sales_money": {"amount": 1200}},
        ]},
        {"closed_at": (_now - timedelta(days=1)).isoformat() + "Z", "line_items": [
            {"name": "Margherita Pizza", "quantity": "1", "gross_sales_money": {"amount": 1200}},
        ]},
    ]
}


def _fake_post(url, body, token=None):
    if url.endswith("/v2/catalog/search"):
        return _CATALOG
    if url.endswith("/v2/orders/search"):
        return _ORDERS
    return {}


def _fake_get(url, token=None):
    return {"merchant": [{"business_name": "Nonna's"}]}


def test_sync_populates_menu_and_sales(db_session, monkeypatch):
    monkeypatch.setattr(sq.settings, "square_app_id", "app")
    monkeypatch.setattr(sq.settings, "square_app_secret", "secret")
    rest = _restaurant(db_session)
    _connect(db_session, rest.id)

    with patch("app.services.square_pos_service._http_post", side_effect=_fake_post), \
         patch("app.services.square_pos_service._http_get", side_effect=_fake_get):
        stats = sq.sync(db_session, rest.id)

    assert stats["items"] == 2
    assert stats["orders"] == 2
    assert stats["revenue"] == 60.0  # 36 + 12 + 12

    items = {i.name: i for i in db_session.query(MenuItem).filter(MenuItem.user_id == rest.id).all()}
    assert "Margherita Pizza" in items
    assert items["Margherita Pizza"].price == 12.0
    # 3 + 1 = 4 pizzas over the window
    assert items["Margherita Pizza"].orders_last_30_days == 4
    assert items["Tiramisu"].orders_last_30_days == 2

    logs = db_session.query(SalesLog).filter(SalesLog.user_id == rest.id).all()
    assert len(logs) == 3  # 2 line items + 1 line item


def test_sync_is_idempotent(db_session, monkeypatch):
    monkeypatch.setattr(sq.settings, "square_app_id", "app")
    monkeypatch.setattr(sq.settings, "square_app_secret", "secret")
    rest = _restaurant(db_session)
    _connect(db_session, rest.id)
    with patch("app.services.square_pos_service._http_post", side_effect=_fake_post), \
         patch("app.services.square_pos_service._http_get", side_effect=_fake_get):
        sq.sync(db_session, rest.id)
        sq.sync(db_session, rest.id)  # second run overwrites, no doubling
    logs = db_session.query(SalesLog).filter(SalesLog.user_id == rest.id).all()
    assert len(logs) == 3


def test_sync_requires_connection(db_session, monkeypatch):
    monkeypatch.setattr(sq.settings, "square_app_id", "app")
    monkeypatch.setattr(sq.settings, "square_app_secret", "secret")
    rest = _restaurant(db_session)
    try:
        sq.sync(db_session, rest.id)
        assert False
    except ValueError:
        pass


def test_sync_noop_when_unconfigured(db_session, monkeypatch):
    monkeypatch.setattr(sq.settings, "square_app_id", "")
    rest = _restaurant(db_session)
    try:
        sq.sync(db_session, rest.id)
        assert False
    except ValueError:
        pass


def test_status_endpoint(client, db_session):
    token, _ = register_user(client, email="posstat@example.com", account_type="restaurant")
    res = client.get("/api/restaurant/pos/status", headers=auth_headers(token))
    assert res.status_code == 200
    assert "connected" in res.json()


def test_start_503_when_unconfigured(client, db_session, monkeypatch):
    monkeypatch.setattr(sq.settings, "square_app_id", "")
    token, _ = register_user(client, email="posstart@example.com", account_type="restaurant")
    res = client.get("/api/restaurant/pos/square/start", headers=auth_headers(token))
    assert res.status_code == 503


def test_sync_endpoint_requires_restaurant(client, db_session):
    token, _ = register_user(client, email="poscons@example.com", account_type="consumer")
    res = client.post("/api/restaurant/pos/sync", headers=auth_headers(token))
    assert res.status_code == 403


def test_sync_all_connected(db_session, monkeypatch):
    monkeypatch.setattr(sq.settings, "square_app_id", "app")
    monkeypatch.setattr(sq.settings, "square_app_secret", "secret")
    rest = _restaurant(db_session, email="posall@example.com")
    _connect(db_session, rest.id)
    with patch("app.services.square_pos_service._http_post", side_effect=_fake_post), \
         patch("app.services.square_pos_service._http_get", side_effect=_fake_get):
        out = sq.sync_all_connected(db_session)
    assert out["synced"] == 1
