"""Unit tests for the new-booking email path.

Covers the small but high-leverage piece of booking_service: when a diner
books via /api/discover/book, the restaurant gets a transactional email.
The helper html-escapes everything that came from form input, so the
tests pin that down — diner_name or special_requests carrying `<script>`
must never reach the rendered HTML unescaped.
"""
from datetime import date
from unittest.mock import patch

from app.services.booking_service import _send_new_booking_email


def _capture_call():
    """Return (sender_mock, getter). Sends through patched send_email and
    returns the (to, subject, html) tuple from the most recent call."""
    sender = patch("app.services.booking_service.resend_client.send_email")
    return sender


def test_confirmed_email_subject_and_body():
    with patch("app.services.booking_service.resend_client.send_email") as send:
        _send_new_booking_email(
            "owner@example.com",
            lang="en",
            diner_name="Alice Chen",
            party_size=4,
            booking_date=date(2026, 6, 15),
            booking_time="19:30",
            special_requests="window seat please",
            confirmed=True,
        )
    assert send.called
    to, subject, html = send.call_args.args
    assert to == "owner@example.com"
    assert "New booking" in subject
    assert "Alice Chen" in subject
    assert "party of 4" in subject
    assert "Alice Chen" in html
    assert "2026-06-15" in html
    assert "19:30" in html
    assert "window seat please" in html


def test_pending_email_signals_action_needed():
    with patch("app.services.booking_service.resend_client.send_email") as send:
        _send_new_booking_email(
            "owner@example.com",
            lang="en",
            diner_name="Bob",
            party_size=2,
            booking_date=date(2026, 6, 15),
            booking_time="20:00",
            special_requests="",
            confirmed=False,
        )
    _, subject, html = send.call_args.args
    # "needs confirmation" / "action needed" — exact phrasing may shift but the
    # restaurant must be able to tell pending from confirmed at a glance.
    assert "request" in subject.lower() or "action" in subject.lower()
    assert "confirmation" in html.lower()


def test_html_escapes_diner_name_against_injection():
    """Diner name is straight from a signup form. Inlining `<script>` raw
    would let any signed-up user XSS the restaurant's email client."""
    with patch("app.services.booking_service.resend_client.send_email") as send:
        _send_new_booking_email(
            "owner@example.com",
            lang="en",
            diner_name="<script>alert(1)</script>",
            party_size=2,
            booking_date=date(2026, 6, 15),
            booking_time="19:00",
            special_requests="",
            confirmed=True,
        )
    _, _subject, html = send.call_args.args
    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;" in html


def test_html_escapes_special_requests():
    with patch("app.services.booking_service.resend_client.send_email") as send:
        _send_new_booking_email(
            "owner@example.com",
            lang="en",
            diner_name="Alice",
            party_size=2,
            booking_date=date(2026, 6, 15),
            booking_time="19:00",
            special_requests="<img src=x onerror=alert(1)>",
            confirmed=True,
        )
    _, _subject, html = send.call_args.args
    assert "<img src=x" not in html
    assert "&lt;img src=x" in html


def test_omits_special_requests_row_when_empty():
    """Empty special_requests should not render an empty 'Special requests:'
    row — keep the email tight."""
    with patch("app.services.booking_service.resend_client.send_email") as send:
        _send_new_booking_email(
            "owner@example.com",
            lang="en",
            diner_name="Alice",
            party_size=2,
            booking_date=date(2026, 6, 15),
            booking_time="19:00",
            special_requests="",
            confirmed=True,
        )
    _, _subject, html = send.call_args.args
    assert "Special requests" not in html


def test_dashboard_link_uses_frontend_url(monkeypatch):
    from app.core import config as cfg
    monkeypatch.setattr(cfg.settings, "frontend_url", "https://savorymind.net")
    with patch("app.services.booking_service.resend_client.send_email") as send:
        _send_new_booking_email(
            "owner@example.com",
            lang="en",
            diner_name="Alice",
            party_size=2,
            booking_date=date(2026, 6, 15),
            booking_time="19:00",
            special_requests="",
            confirmed=True,
        )
    _, _subject, html = send.call_args.args
    assert "https://savorymind.net/restaurant/bookings" in html


def test_strips_trailing_slash_on_frontend_url(monkeypatch):
    """A trailing slash in FRONTEND_URL shouldn't produce a double-slash in
    the dashboard link."""
    from app.core import config as cfg
    monkeypatch.setattr(cfg.settings, "frontend_url", "https://savorymind.net/")
    with patch("app.services.booking_service.resend_client.send_email") as send:
        _send_new_booking_email(
            "owner@example.com",
            lang="en",
            diner_name="Alice",
            party_size=2,
            booking_date=date(2026, 6, 15),
            booking_time="19:00",
            special_requests="",
            confirmed=True,
        )
    _, _subject, html = send.call_args.args
    assert "savorymind.net//restaurant" not in html
    assert "savorymind.net/restaurant/bookings" in html
