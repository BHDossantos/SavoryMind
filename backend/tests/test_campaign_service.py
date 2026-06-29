"""Tests for the AI campaign generator.

Pins the contract: with Claude on we get back all five channels populated;
with Claude off (or refusing) we still get a localized fallback so the
operator never sees a blank screen. The /campaigns/generate endpoint is
restaurant-only and pulls the booking link from the user's slug.
"""
from unittest.mock import patch

from app.services import campaign_service

from .conftest import register_user, auth_headers


def test_fallback_when_claude_unconfigured(monkeypatch):
    monkeypatch.setattr("app.services.claude_client.is_configured", lambda: False)
    out = campaign_service.generate(
        dish="Tagliatelle al ragù", restaurant_name="Trattoria T",
        language="it", booking_link="https://savorymind.net/r/trat",
    )
    assert out["instagram_caption"]
    assert out["whatsapp_message"]
    assert out["email_subject"]
    assert out["email_body"]
    assert out["sms_body"]
    # Italian fallback uses Italian copy
    assert "Trattoria T" in out["whatsapp_message"]


def test_uses_claude_when_configured(monkeypatch):
    fake = {
        "headline": "Truffle Pasta Friday",
        "instagram_caption": "Come for the pasta. #truffle",
        "whatsapp_message":  "Friday is for truffle. Save a seat?",
        "email_subject":     "Truffle Pasta — Friday",
        "email_body":        "Our truffle pasta returns Friday. Book early.",
        "sms_body":          "Truffle pasta Friday. Book early.",
    }
    with patch("app.services.campaign_service.claude_client.call_json", return_value=fake):
        out = campaign_service.generate(dish="Truffle Pasta", restaurant_name="X")
    assert out == fake


def test_endpoint_requires_restaurant(client, db_session):
    token, _ = register_user(client, email="consumcamp@example.com", account_type="consumer")
    res = client.post(
        "/api/restaurant/campaigns/generate",
        headers=auth_headers(token),
        json={"dish": "Pizza"},
    )
    assert res.status_code == 403


def test_endpoint_happy_path(client, db_session, monkeypatch):
    monkeypatch.setattr("app.services.claude_client.is_configured", lambda: False)
    token, _ = register_user(client, email="restcamp@example.com", account_type="restaurant")
    res = client.post(
        "/api/restaurant/campaigns/generate",
        headers=auth_headers(token),
        json={"dish": "Lobster Bisque", "notes": "Friday 7pm"},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    for k in ("instagram_caption", "whatsapp_message", "email_subject", "email_body", "sms_body"):
        assert data.get(k), f"missing channel: {k}"
