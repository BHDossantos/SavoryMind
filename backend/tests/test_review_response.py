"""Tests for the review-response AI draft/save flow.

Pins the contract: draft endpoint returns a tone-appropriate body, save
endpoint persists to Review.response + responded_at, fallback works when
Claude is unconfigured, and consumer accounts are 403'd.
"""
from unittest.mock import patch

from app.models.review import Review
from app.services import review_response_service

from .conftest import register_user, auth_headers


def test_fallback_low_rating_is_empathetic(monkeypatch):
    monkeypatch.setattr("app.services.claude_client.is_configured", lambda: False)
    out = review_response_service.generate(
        rating=2, comment="The pasta was cold.", guest_name="Marco",
        restaurant_name="Trattoria T", language="it",
    )
    assert out["tone"] == "empathetic"
    assert "Marco" in out["response"]


def test_fallback_high_rating_is_warm(monkeypatch):
    monkeypatch.setattr("app.services.claude_client.is_configured", lambda: False)
    out = review_response_service.generate(
        rating=5, comment="Amazing meal!", guest_name="Anna",
        restaurant_name="Trattoria T", language="en",
    )
    assert out["tone"] == "warm"
    assert "Trattoria T" in out["response"]


def test_fallback_mid_rating_is_measured(monkeypatch):
    monkeypatch.setattr("app.services.claude_client.is_configured", lambda: False)
    out = review_response_service.generate(
        rating=3, comment="Just OK.", language="en",
    )
    assert out["tone"] == "measured"


def test_draft_endpoint_returns_response(client, db_session):
    token, user = register_user(client, email="restresp@example.com", account_type="restaurant")
    r = Review(user_id=user["id"], customer_name="Marco", menu_item="Pasta",
               rating=2, comment="Cold pasta")
    db_session.add(r); db_session.commit(); db_session.refresh(r)
    with patch("app.services.claude_client.is_configured", return_value=False):
        res = client.post(f"/api/reviews/{r.id}/draft-response", headers=auth_headers(token))
    assert res.status_code == 200, res.text
    assert res.json()["response"]


def test_save_response_persists(client, db_session):
    token, user = register_user(client, email="restresp2@example.com", account_type="restaurant")
    r = Review(user_id=user["id"], customer_name="Marco", menu_item="Pasta",
               rating=2, comment="Cold")
    db_session.add(r); db_session.commit(); db_session.refresh(r)
    res = client.patch(
        f"/api/reviews/{r.id}/response", headers=auth_headers(token),
        json={"response": "Thanks Marco, we'll do better."},
    )
    assert res.status_code == 200
    db_session.refresh(r)
    assert r.response == "Thanks Marco, we'll do better."
    assert r.responded_at is not None


def test_save_response_clears_when_blank(client, db_session):
    token, user = register_user(client, email="restresp3@example.com", account_type="restaurant")
    r = Review(user_id=user["id"], customer_name="A", menu_item="P", rating=4, comment="ok")
    db_session.add(r); db_session.commit(); db_session.refresh(r)
    client.patch(f"/api/reviews/{r.id}/response", headers=auth_headers(token),
                 json={"response": "draft"})
    client.patch(f"/api/reviews/{r.id}/response", headers=auth_headers(token),
                 json={"response": ""})
    db_session.refresh(r)
    assert r.response is None
    assert r.responded_at is None


def test_consumer_account_blocked(client, db_session):
    token, _ = register_user(client, email="conresp@example.com", account_type="consumer")
    res = client.post("/api/reviews/1/draft-response", headers=auth_headers(token))
    assert res.status_code == 403
