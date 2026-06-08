"""Tests for the localized transactional message templates.

The Italian pilot's restaurants would otherwise get English emails/SMS
while the rest of the product runs in Italian — pinning the locale
selection here guards against regressions when templates evolve.
"""
from datetime import date
from unittest.mock import patch

from app.services import email_templates as t
from app.services.booking_service import _send_new_booking_email, _send_new_booking_sms


def test_italian_subject_uses_italian_words():
    s = t.new_booking_subject("it", diner_name="Alice", party_size=4, confirmed=True)
    assert "Nuova prenotazione" in s
    assert "Alice" in s
    assert "tavolo da 4" in s


def test_pending_italian_subject_flags_action_needed():
    s = t.new_booking_subject("it", diner_name="Bob", party_size=2, confirmed=False)
    assert "Richiesta" in s
    assert "azione richiesta" in s.lower()


def test_unknown_language_falls_back_to_english():
    s = t.new_booking_subject("xx", diner_name="Alice", party_size=2, confirmed=True)
    assert "New booking" in s


def test_locale_normalises_regional_codes():
    # "it-IT" should resolve to "it"
    s = t.new_booking_subject("it-IT", diner_name="Alice", party_size=2, confirmed=True)
    assert "Nuova" in s


def test_italian_sms_uses_italian():
    body = t.new_booking_sms("it", diner_name="Alice", party_size=3,
                              booking_date="2026-06-15", booking_time="20:00", confirmed=True)
    assert "nuova prenotazione" in body.lower()
    assert "alle 20:00" in body


def test_french_reminder_uses_french():
    body = t.reminder_sms("fr", rest_label="Chez Marie", party_size=2,
                          booking_date="2026-06-15", booking_time="20:00")
    assert "Rappel SavoryMind" in body
    assert "Chez Marie" in body
    assert "table de 2" in body


def test_booking_email_dispatches_italian_when_lang_is_it():
    with patch("app.services.booking_service.resend_client.send_email") as send:
        _send_new_booking_email(
            "owner@example.com",
            lang="it",
            diner_name="Alessia",
            party_size=4,
            booking_date=date(2026, 6, 15),
            booking_time="19:30",
            special_requests="vicino alla finestra",
            confirmed=True,
        )
    _to, subject, html = send.call_args.args
    assert "Nuova prenotazione" in subject
    assert "Cliente" in html or "Tavolo" in html
    assert "Apri la dashboard" in html
    # The special-requests row's label should be Italian too
    assert "Richieste speciali" in html


def test_booking_sms_dispatches_italian_when_lang_is_it():
    with patch("app.services.booking_service.twilio_client.send_sms") as send:
        _send_new_booking_sms(
            "+393334445566",
            lang="it",
            diner_name="Marco",
            party_size=2,
            booking_date=date(2026, 6, 15),
            booking_time="20:00",
            confirmed=True,
        )
    _to, body = send.call_args.args
    assert "nuova prenotazione" in body.lower()
    assert "alle 20:00" in body
