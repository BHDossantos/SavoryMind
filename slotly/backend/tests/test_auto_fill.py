"""Phase 07 auto-fill cancellations — the 8 smoke scenarios as repeatable tests."""
from datetime import datetime, timedelta

from sqlmodel import select

from app.models import Appointment, Notification, NotificationKind, SearchLog
from conftest import make_provider, signup, tomorrow_at


def _search(client, headers=None, category="barber", city="Rome"):
    return client.get(
        "/search/providers",
        params={"category": category, "city": city},
        headers=headers or {},
    )


def _book(client, headers, service_id, start_at):
    r = client.post(
        "/appointments", headers=headers,
        json={"service_id": service_id, "start_at": start_at},
    )
    assert r.status_code == 200, r.text
    return r.json()["appointment"]["id"]


def _auto_fill_rows(session):
    return session.exec(
        select(Notification).where(Notification.kind == NotificationKind.auto_fill_slot)
    ).all()


def test_authenticated_customer_search_is_logged(client, session):
    make_provider(client, session)
    cust = signup(client, "cust@test.io")
    _search(client, cust)
    logs = session.exec(select(SearchLog)).all()
    assert len(logs) == 1
    assert logs[0].category == "barber" and logs[0].city == "Rome"


def test_anonymous_and_provider_searches_not_logged(client, session):
    prov = make_provider(client, session)
    _search(client)  # anonymous
    _search(client, prov["headers"])  # provider role
    assert session.exec(select(SearchLog)).all() == []


def test_cancellation_broadcasts_to_matching_searchers_only(client, session):
    prov = make_provider(client, session)
    alice = signup(client, "alice@test.io")
    bob = signup(client, "bob@test.io")
    carol = signup(client, "carol@test.io")
    dan = signup(client, "dan@test.io")

    _search(client, alice)                      # barber/Rome -> matches
    _search(client, bob)                        # barber/Rome -> matches
    _search(client, carol, category="nails")    # nails -> no match
    _search(client)                             # anonymous -> not logged

    appt_id = _book(client, dan, prov["service_id"], tomorrow_at(10))
    client.post(f"/appointments/{appt_id}/cancel", headers=dan)

    rows = _auto_fill_rows(session)
    recipients = sorted(n.to_address for n in rows)
    assert recipients == ["alice@test.io", "bob@test.io"]
    assert all("Just opened" in n.subject for n in rows)


def test_canceller_is_excluded_even_if_they_searched(client, session):
    prov = make_provider(client, session)
    dan = signup(client, "dan@test.io")
    _search(client, dan)  # Dan searched barber/Rome himself

    appt_id = _book(client, dan, prov["service_id"], tomorrow_at(10))
    client.post(f"/appointments/{appt_id}/cancel", headers=dan)

    assert _auto_fill_rows(session) == []


def test_rate_limit_suppresses_repeat_broadcasts(client, session):
    prov_a = make_provider(client, session, email="a@shop.io")
    prov_b = make_provider(client, session, email="b@shop.io")
    alice = signup(client, "alice@test.io")
    dan = signup(client, "dan@test.io")
    _search(client, alice)

    appt1 = _book(client, dan, prov_a["service_id"], tomorrow_at(10))
    client.post(f"/appointments/{appt1}/cancel", headers=dan)
    assert len(_auto_fill_rows(session)) == 1

    appt2 = _book(client, dan, prov_b["service_id"], tomorrow_at(11))
    client.post(f"/appointments/{appt2}/cancel", headers=dan)
    assert len(_auto_fill_rows(session)) == 1, "24h rate limit must hold"


def test_past_slot_cancellation_does_not_broadcast(client, session):
    prov = make_provider(client, session)
    alice = signup(client, "alice@test.io")
    dan = signup(client, "dan@test.io")
    _search(client, alice)

    appt_id = _book(client, dan, prov["service_id"], tomorrow_at(10))
    appt = session.get(Appointment, appt_id)
    appt.start_at = datetime.utcnow() - timedelta(days=1)
    appt.end_at = appt.start_at + timedelta(minutes=30)
    session.add(appt)
    session.commit()

    client.post(f"/appointments/{appt_id}/cancel", headers=dan)
    assert _auto_fill_rows(session) == []


def test_recipient_cap_at_max(client, session):
    prov = make_provider(client, session)
    dan = signup(client, "dan@test.io")
    for i in range(25):
        h = signup(client, f"bulk{i}@test.io")
        _search(client, h)

    appt_id = _book(client, dan, prov["service_id"], tomorrow_at(10))
    client.post(f"/appointments/{appt_id}/cancel", headers=dan)

    assert len(_auto_fill_rows(session)) == 20


def test_stale_search_outside_lookback_excluded(client, session):
    prov = make_provider(client, session)
    alice = signup(client, "alice@test.io")
    dan = signup(client, "dan@test.io")
    _search(client, alice)

    log = session.exec(select(SearchLog)).one()
    log.created_at = datetime.utcnow() - timedelta(days=30)  # beyond the 14-day window
    session.add(log)
    session.commit()

    appt_id = _book(client, dan, prov["service_id"], tomorrow_at(10))
    client.post(f"/appointments/{appt_id}/cancel", headers=dan)
    assert _auto_fill_rows(session) == []
