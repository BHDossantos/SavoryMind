"""Admin leads view — same ADMIN_EMAILS allowlist gating as pilots."""
import os
from unittest.mock import patch

from .conftest import register_user, auth_headers


def test_leads_403_when_allowlist_unset(client):
    token, _ = register_user(client, email="nobody@example.com", account_type="restaurant")
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("ADMIN_EMAILS", None)
        res = client.get("/api/admin/leads", headers=auth_headers(token))
    assert res.status_code == 403


def test_leads_403_for_non_admin(client):
    token, _ = register_user(client, email="regular@example.com", account_type="restaurant")
    with patch.dict(os.environ, {"ADMIN_EMAILS": "boss@savorymind.net"}):
        res = client.get("/api/admin/leads", headers=auth_headers(token))
    assert res.status_code == 403


def test_leads_returns_captured_leads_for_admin(client):
    # A public visitor submits a lead via the calculator endpoint...
    assert client.post("/api/loss/lead", json={
        "email": "prospect@trattoria.it", "restaurant_name": "Da Mario",
        "covers_per_day": 90, "band_low": 500, "band_high": 1200,
    }).status_code == 200

    token, _ = register_user(client, email="admin@savorymind.net", account_type="restaurant")
    with patch.dict(os.environ, {"ADMIN_EMAILS": "admin@savorymind.net"}):
        res = client.get("/api/admin/leads", headers=auth_headers(token))
    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 1
    assert body["last_7d"] >= 1
    mine = [l for l in body["leads"] if l["email"] == "prospect@trattoria.it"]
    assert mine and mine[0]["restaurant_name"] == "Da Mario"
    assert mine[0]["loss_band"] == [500, 1200]
