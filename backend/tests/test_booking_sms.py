"""Unit tests for the new-booking SMS path.

Mirror of test_booking_emails — but SMS bodies are plain text, so no
HTML-escape concerns. We pin the subject phrasing (confirmed vs pending),
the bypass when the restaurant hasn't set a phone, and the no-op when
Twilio isn't configured.
"""
from datetime import date
from unittest.mock import patch

from app.services.booking_service import _send_new_booking_sms


def test_confirmed_sms_body():
    with patch("app.services.booking_service.twilio_client.send_sms") as send:
        _send_new_booking_sms(
            "+15555550100",
            lang="en",
            diner_name="Alice",
            party_size=3,
            booking_date=date(2026, 6, 15),
            booking_time="19:30",
            confirmed=True,
        )
    assert send.called
    to, body = send.call_args.args
    assert to == "+15555550100"
    assert "SavoryMind" in body
    assert "new booking" in body
    assert "Alice" in body
    assert "party of 3" in body
    assert "2026-06-15" in body
    assert "19:30" in body
    # Confirmed body should NOT say "needs your confirmation"
    assert "confirmation" not in body.lower()


def test_pending_sms_signals_action_needed():
    with patch("app.services.booking_service.twilio_client.send_sms") as send:
        _send_new_booking_sms(
            "+15555550100",
            lang="en",
            diner_name="Bob",
            party_size=2,
            booking_date=date(2026, 6, 15),
            booking_time="20:00",
            confirmed=False,
        )
    _, body = send.call_args.args
    assert "request" in body.lower()
    assert "confirmation" in body.lower()


def test_twilio_client_no_ops_when_unconfigured(monkeypatch):
    """send_sms returns False without raising when env is empty."""
    from app.services import twilio_client

    monkeypatch.delenv("TWILIO_ACCOUNT_SID", raising=False)
    monkeypatch.delenv("TWILIO_AUTH_TOKEN", raising=False)
    monkeypatch.delenv("TWILIO_FROM_PHONE", raising=False)
    assert twilio_client.is_configured() is False
    assert twilio_client.send_sms("+15555550100", "test") is False


def test_twilio_client_rejects_non_e164(monkeypatch):
    """Phone numbers that don't start with + are skipped silently — Twilio
    rejects them server-side with a paid request error."""
    from app.services import twilio_client

    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC_test")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "tok_test")
    monkeypatch.setenv("TWILIO_FROM_PHONE", "+15555550000")
    assert twilio_client.send_sms("5555550100", "test") is False    # missing +
    assert twilio_client.send_sms("",            "test") is False    # empty
    assert twilio_client.send_sms("not-a-number","test") is False    # garbage
