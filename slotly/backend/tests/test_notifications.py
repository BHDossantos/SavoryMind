"""Notification lifecycle: enqueue fan-out, idempotency, deposit gating, scheduler."""
from datetime import datetime, timedelta

from sqlmodel import select

from app.models import Notification, NotificationKind, NotificationStatus
from app.notifications_service import enqueue_for_appointment, process_due
from conftest import days_ahead_at, make_provider, signup, tomorrow_at


def _notifs(session, appt_id=None):
    stmt = select(Notification)
    if appt_id is not None:
        stmt = stmt.where(Notification.appointment_id == appt_id)
    return session.exec(stmt).all()


def _book(client, headers, service_id, start_at):
    r = client.post(
        "/appointments", headers=headers,
        json={"service_id": service_id, "start_at": start_at},
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_booking_enqueues_confirmation_and_reminders(client, session):
    prov = make_provider(client, session)
    cust = signup(client, "cust@test.io")
    appt = _book(client, cust, prov["service_id"], tomorrow_at(10))["appointment"]

    rows = _notifs(session, appt["id"])
    kinds = sorted(n.kind for n in rows)
    assert kinds == [
        NotificationKind.booking_confirmed,
        NotificationKind.reminder_24h,
        NotificationKind.reminder_2h,
    ]
    by_kind = {n.kind: n for n in rows}
    start = datetime.fromisoformat(appt["start_at"])
    assert by_kind[NotificationKind.reminder_24h].scheduled_at == start - timedelta(hours=24)
    assert by_kind[NotificationKind.reminder_2h].scheduled_at == start - timedelta(hours=2)


def test_enqueue_is_idempotent(client, session):
    prov = make_provider(client, session)
    cust = signup(client, "cust@test.io")
    appt = _book(client, cust, prov["service_id"], tomorrow_at(10))["appointment"]

    created = enqueue_for_appointment(session, appt["id"])
    session.commit()
    assert created == [], "second enqueue must be a no-op"
    assert len(_notifs(session, appt["id"])) == 3


def test_deposit_booking_defers_notifications_until_paid(client, session):
    prov = make_provider(client, session, deposit_cents=1000)
    cust = signup(client, "cust@test.io")
    body = _book(client, cust, prov["service_id"], tomorrow_at(10))
    appt_id = body["appointment"]["id"]

    assert _notifs(session, appt_id) == [], "no notifications before deposit lands"

    client.post(f"/payments/stub-confirm/{body['payment_id']}", headers=cust)
    assert len(_notifs(session, appt_id)) == 3, "payment confirmation triggers the fan-out"


def test_cancellation_cancels_reminders_and_notifies(client, session):
    prov = make_provider(client, session)
    cust = signup(client, "cust@test.io")
    appt_id = _book(client, cust, prov["service_id"], tomorrow_at(10))["appointment"]["id"]

    client.post(f"/appointments/{appt_id}/cancel", headers=cust)

    by_kind = {n.kind: n for n in _notifs(session, appt_id)}
    assert by_kind[NotificationKind.reminder_24h].status == NotificationStatus.cancelled
    assert by_kind[NotificationKind.reminder_2h].status == NotificationStatus.cancelled
    assert by_kind[NotificationKind.booking_cancelled].status == NotificationStatus.pending


def test_process_due_sends_only_due_notifications(client, session):
    prov = make_provider(client, session)
    cust = signup(client, "cust@test.io")
    # Book 3 days out: a next-day slot would put the 24h reminder in the past
    # and make it immediately due alongside the confirmation.
    appt_id = _book(client, cust, prov["service_id"], days_ahead_at(3, 10))["appointment"]["id"]

    sent = process_due(session)
    assert sent == 1, "only the immediate confirmation is due"

    by_kind = {n.kind: n for n in _notifs(session, appt_id)}
    assert by_kind[NotificationKind.booking_confirmed].status == NotificationStatus.sent
    assert by_kind[NotificationKind.reminder_24h].status == NotificationStatus.pending


def test_process_due_sends_backdated_reminder(client, session):
    prov = make_provider(client, session)
    cust = signup(client, "cust@test.io")
    appt_id = _book(client, cust, prov["service_id"], days_ahead_at(3, 10))["appointment"]["id"]
    process_due(session)  # flush the confirmation

    reminder = next(
        n for n in _notifs(session, appt_id) if n.kind == NotificationKind.reminder_24h
    )
    reminder.scheduled_at = datetime.utcnow() - timedelta(minutes=1)
    session.add(reminder)
    session.commit()

    assert process_due(session) == 1
