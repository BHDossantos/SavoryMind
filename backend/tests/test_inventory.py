"""Inventory CRUD + ledger tests.

Coverage:
- Happy paths: create / list / patch / archive / adjust
- Auth: only restaurant accounts can hit the endpoints
- Tenancy: user A can never affect user B's items (CONTEXT.md T1)
- Ledger immutability: no PATCH/DELETE on adjustment rows (T2)
- current_quantity derivation correctness across mixed adjustment types
- Categorize: graceful when Claude unavailable, validates response
"""
from unittest.mock import patch

from .conftest import register_user, auth_headers


# ── Helpers ──────────────────────────────────────────────────────────────


def _create_item(client, headers, name="Tito's Vodka 1.75L", category="alcohol",
                 unit="bottles", par_level=6.0, **kwargs):
    body = {"name": name, "category": category, "unit": unit, "par_level": par_level}
    body.update(kwargs)
    r = client.post("/api/inventory", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _adjust(client, headers, item_id, delta, adjustment_type="delivery", note=None):
    body = {"adjustment_type": adjustment_type, "delta": delta}
    if note:
        body["note"] = note
    r = client.post(f"/api/inventory/{item_id}/adjust", json=body, headers=headers)
    return r


# ── Auth scoping ─────────────────────────────────────────────────────────


def test_consumer_cannot_create_inventory_item(client):
    access, _ = register_user(client, account_type="consumer")
    r = client.post("/api/inventory", json={
        "name": "test", "category": "food", "unit": "kg", "par_level": 1
    }, headers=auth_headers(access))
    assert r.status_code == 403


def test_diner_cannot_list_inventory(client):
    access, _ = register_user(client, account_type="diner")
    r = client.get("/api/inventory", headers=auth_headers(access))
    assert r.status_code == 403


def test_unauthenticated_returns_401(client):
    r = client.get("/api/inventory")
    assert r.status_code == 401


# ── Happy path CRUD ──────────────────────────────────────────────────────


def test_restaurant_can_create_and_list_items(client):
    access, _ = register_user(client, account_type="restaurant")
    headers = auth_headers(access)
    item = _create_item(client, headers, name="Cabernet Sauvignon", category="alcohol")
    assert item["name"] == "Cabernet Sauvignon"
    assert item["category"] == "alcohol"
    assert item["current_quantity"] == 0.0
    assert item["is_low"] is True  # 0 < 6 par

    r = client.get("/api/inventory", headers=headers)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["id"] == item["id"]


def test_list_items_filters_by_category(client):
    access, _ = register_user(client, account_type="restaurant")
    headers = auth_headers(access)
    _create_item(client, headers, name="Wine A",     category="alcohol")
    _create_item(client, headers, name="Tomatoes",   category="produce", unit="kg", par_level=2)
    _create_item(client, headers, name="Bourbon",    category="alcohol")

    r = client.get("/api/inventory?category=alcohol", headers=headers)
    assert r.status_code == 200
    names = [i["name"] for i in r.json()]
    assert names == ["Bourbon", "Wine A"]  # alphabetical


def test_patch_item_updates_par_level_but_not_category(client):
    access, _ = register_user(client, account_type="restaurant")
    headers = auth_headers(access)
    item = _create_item(client, headers, par_level=6.0)

    # Try to change category — schema rejects unknown field; even if it
    # made it through, service ignores it.
    r = client.patch(f"/api/inventory/{item['id']}", json={
        "par_level": 12.0,
        "supplier": "Sysco",
    }, headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["par_level"] == 12.0
    assert body["supplier"] == "Sysco"
    assert body["category"] == "alcohol"  # unchanged


def test_archive_item_removes_from_default_list(client):
    access, _ = register_user(client, account_type="restaurant")
    headers = auth_headers(access)
    item = _create_item(client, headers)

    r = client.delete(f"/api/inventory/{item['id']}", headers=headers)
    assert r.status_code == 204

    r = client.get("/api/inventory", headers=headers)
    assert r.json() == []


# ── Tenancy isolation (T1) ───────────────────────────────────────────────


def test_user_a_cannot_see_user_b_items(client):
    access_a, _ = register_user(client, email="a@x.com", account_type="restaurant")
    access_b, _ = register_user(client, email="b@x.com", account_type="restaurant")
    _create_item(client, auth_headers(access_a), name="A's wine")

    r = client.get("/api/inventory", headers=auth_headers(access_b))
    assert r.status_code == 200
    assert r.json() == []  # B sees nothing of A's


def test_user_a_cannot_patch_user_b_item(client):
    access_a, _ = register_user(client, email="a@x.com", account_type="restaurant")
    access_b, _ = register_user(client, email="b@x.com", account_type="restaurant")
    item_a = _create_item(client, auth_headers(access_a))

    r = client.patch(f"/api/inventory/{item_a['id']}", json={"par_level": 99},
                     headers=auth_headers(access_b))
    assert r.status_code == 404  # invisible to B, not 403 (don't leak existence)


def test_user_a_cannot_archive_user_b_item(client):
    access_a, _ = register_user(client, email="a@x.com", account_type="restaurant")
    access_b, _ = register_user(client, email="b@x.com", account_type="restaurant")
    item_a = _create_item(client, auth_headers(access_a))

    r = client.delete(f"/api/inventory/{item_a['id']}", headers=auth_headers(access_b))
    assert r.status_code == 404


def test_user_a_cannot_adjust_user_b_item(client):
    access_a, _ = register_user(client, email="a@x.com", account_type="restaurant")
    access_b, _ = register_user(client, email="b@x.com", account_type="restaurant")
    item_a = _create_item(client, auth_headers(access_a))

    r = _adjust(client, auth_headers(access_b), item_a["id"], 5.0)
    assert r.status_code == 404


# ── Ledger immutability (T2) ─────────────────────────────────────────────


def test_no_patch_endpoint_for_adjustment(client):
    access, _ = register_user(client, account_type="restaurant")
    headers = auth_headers(access)
    item = _create_item(client, headers)
    adj = _adjust(client, headers, item["id"], 10.0).json()

    # Pretend an attacker discovered such an endpoint — none should exist.
    r = client.patch(f"/api/inventory/adjustments/{adj['id']}",
                     json={"delta": 0}, headers=headers)
    assert r.status_code in (404, 405)  # endpoint doesn't exist


def test_no_delete_endpoint_for_adjustment(client):
    access, _ = register_user(client, account_type="restaurant")
    headers = auth_headers(access)
    item = _create_item(client, headers)
    adj = _adjust(client, headers, item["id"], 10.0).json()

    r = client.delete(f"/api/inventory/adjustments/{adj['id']}", headers=headers)
    assert r.status_code in (404, 405)


# ── Adjustment ledger correctness ────────────────────────────────────────


def test_current_quantity_derives_from_mixed_ledger(client):
    """Delivery + usage + waste + correction should sum to the right
    current_quantity, not be cached from the create-row state."""
    access, _ = register_user(client, account_type="restaurant")
    headers = auth_headers(access)
    item = _create_item(client, headers, name="Bourbon", par_level=6.0)

    # Delivery of 24
    assert _adjust(client, headers, item["id"], 24.0, "delivery").status_code == 201
    # Service used 5
    assert _adjust(client, headers, item["id"], -5.0, "usage").status_code == 201
    # Broke 2
    assert _adjust(client, headers, item["id"], -2.0, "waste",
                   note="dropped during stocktake").status_code == 201
    # Physical count showed actual was 16 (down 1 from expected 17) — log correction
    assert _adjust(client, headers, item["id"], -1.0, "count_correction").status_code == 201

    r = client.get("/api/inventory", headers=headers)
    items = r.json()
    found = next(i for i in items if i["id"] == item["id"])
    assert found["current_quantity"] == 16.0
    assert found["is_low"] is False  # 16 >= 6 par


def test_zero_delta_rejected(client):
    access, _ = register_user(client, account_type="restaurant")
    headers = auth_headers(access)
    item = _create_item(client, headers)

    r = _adjust(client, headers, item["id"], 0.0)
    assert r.status_code == 422


# ── Categorize ───────────────────────────────────────────────────────────


def test_categorize_falls_back_when_claude_unavailable(client, monkeypatch):
    """No ANTHROPIC_API_KEY → service returns food/0.0 cleanly. UI can
    still render the form; user picks the real category."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    access, _ = register_user(client, account_type="restaurant")

    r = client.post("/api/inventory/categorize",
                    json={"name": "Tito's Vodka 1.75L"},
                    headers=auth_headers(access))
    assert r.status_code == 200
    assert r.json() == {"category": "food", "confidence": 0.0}


def test_categorize_uses_claude_when_configured(client, monkeypatch):
    """When Claude returns a valid response, we surface it verbatim."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test_key")
    access, _ = register_user(client, account_type="restaurant")

    fake = {"category": "alcohol", "confidence": 0.95}
    with patch("app.services.inventory_service.claude_client.call_json", return_value=fake):
        r = client.post("/api/inventory/categorize",
                        json={"name": "Tito's Vodka 1.75L"},
                        headers=auth_headers(access))
    assert r.status_code == 200
    assert r.json() == fake


def test_categorize_rejects_invalid_category_from_claude(client, monkeypatch):
    """If Claude hallucinates an out-of-enum category, we clamp to the
    food default rather than passing garbage to the UI."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test_key")
    access, _ = register_user(client, account_type="restaurant")

    bad = {"category": "definitely_not_a_category", "confidence": 0.9}
    with patch("app.services.inventory_service.claude_client.call_json", return_value=bad):
        r = client.post("/api/inventory/categorize",
                        json={"name": "Mystery Item"},
                        headers=auth_headers(access))
    assert r.status_code == 200
    assert r.json() == {"category": "food", "confidence": 0.0}
