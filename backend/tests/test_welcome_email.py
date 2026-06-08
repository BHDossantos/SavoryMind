"""Tests for the welcome email triggered on onboarding completion."""
from unittest.mock import patch

from .conftest import register_user, auth_headers


def _complete_restaurant_onboarding(client, headers, name="Trattoria di Roma"):
    """PATCH /api/auth/profile with the fields the onboarding flow sends."""
    return client.patch("/api/auth/profile", json={
        "display_name":        "Owner",
        "first_name":          "Marco",
        "last_name":           "Rossi",
        "restaurant_name":     name,
        "city":                "Roma",
        "country":             "Italy",
        "seating_capacity":    40,
        "language":            "it",
        "onboarding_completed": True,
    }, headers=headers)


def test_welcome_email_fires_on_onboarding_completion(client, db_session):
    token, _ = register_user(client, email="r@example.com", account_type="restaurant")
    headers = auth_headers(token)
    with patch("app.services.welcome_email.resend_client.send_email") as send:
        res = _complete_restaurant_onboarding(client, headers)
    assert res.status_code == 200
    assert send.called
    to, subject, html = send.call_args.args
    assert to == "r@example.com"
    # Italian operator chose lang=it
    assert "Benvenuti" in subject or "Benvenuti" in html
    # The email must contain the share link the restaurant pastes into WhatsApp
    assert "/r/" in html
    # Sample WhatsApp message included
    assert "WhatsApp" in html or "Prenota qui" in html


def test_welcome_email_does_not_fire_twice(client, db_session):
    """Re-PATCHing with onboarding_completed=True (already true) shouldn't
    send the welcome again — restaurants edit their profile multiple times."""
    token, _ = register_user(client, email="r2@example.com", account_type="restaurant")
    headers = auth_headers(token)
    with patch("app.services.welcome_email.resend_client.send_email") as send:
        _complete_restaurant_onboarding(client, headers)
        assert send.call_count == 1
        # Second PATCH — onboarding was already complete from the first call.
        _complete_restaurant_onboarding(client, headers, name="Updated Name")
        assert send.call_count == 1


def test_welcome_email_skipped_for_consumer(client, db_session):
    token, _ = register_user(client, email="c@example.com", account_type="consumer")
    headers = auth_headers(token)
    with patch("app.services.welcome_email.resend_client.send_email") as send:
        client.patch("/api/auth/profile", json={
            "first_name":          "Alice",
            "last_name":           "Chen",
            "city":                "Roma",
            "onboarding_completed": True,
        }, headers=headers)
    assert not send.called


def test_welcome_email_includes_correct_share_link(client, db_session):
    token, _ = register_user(client, email="r3@example.com", account_type="restaurant")
    headers = auth_headers(token)
    with patch("app.services.welcome_email.resend_client.send_email") as send:
        _complete_restaurant_onboarding(client, headers, name="L'Osteria Test")
    _to, _subject, html = send.call_args.args
    # slug auto-generated; strips Italian apostrophes per slug_service
    assert "/r/losteria-test" in html
