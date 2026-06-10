"""Booking + cancellation paths: the riskiest user-facing logic."""
from conftest import make_provider, signup, tomorrow_at


def book(client, headers, service_id, start_at):
    return client.post(
        "/appointments",
        headers=headers,
        json={"service_id": service_id, "start_at": start_at},
    )


def test_booking_happy_path(client, session):
    prov = make_provider(client, session)
    cust = signup(client, "cust@test.io")
    r = book(client, cust, prov["service_id"], tomorrow_at(10))
    assert r.status_code == 200, r.text
    appt = r.json()["appointment"]
    assert appt["status"] == "confirmed"
    assert appt["payment_status"] == "not_required"
    assert r.json()["checkout_url"] is None


def test_double_booking_rejected_with_409(client, session):
    prov = make_provider(client, session)
    a = signup(client, "a@test.io")
    b = signup(client, "b@test.io")
    assert book(client, a, prov["service_id"], tomorrow_at(10)).status_code == 200
    assert book(client, b, prov["service_id"], tomorrow_at(10)).status_code == 409


def test_overlapping_booking_rejected(client, session):
    prov = make_provider(client, session)
    a = signup(client, "a@test.io")
    b = signup(client, "b@test.io")
    # 30-min service: 10:00-10:30 then 10:15 overlaps
    assert book(client, a, prov["service_id"], tomorrow_at(10)).status_code == 200
    assert book(client, b, prov["service_id"], tomorrow_at(10, 15)).status_code == 409
    # 10:30 back-to-back is fine
    assert book(client, b, prov["service_id"], tomorrow_at(10, 30)).status_code == 200


def test_booking_in_the_past_rejected(client, session):
    prov = make_provider(client, session)
    cust = signup(client, "cust@test.io")
    r = book(client, cust, prov["service_id"], "2020-01-01T10:00:00")
    assert r.status_code == 400


def test_booking_outside_working_hours_rejected(client, session):
    prov = make_provider(client, session)
    cust = signup(client, "cust@test.io")
    # availability is 09-19; 20:00 is out
    r = book(client, cust, prov["service_id"], tomorrow_at(20))
    assert r.status_code == 409


def test_customer_can_cancel_own_booking(client, session):
    prov = make_provider(client, session)
    cust = signup(client, "cust@test.io")
    appt_id = book(client, cust, prov["service_id"], tomorrow_at(10)).json()["appointment"]["id"]
    r = client.post(f"/appointments/{appt_id}/cancel", headers=cust)
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled_by_customer"


def test_provider_can_cancel_their_booking(client, session):
    prov = make_provider(client, session)
    cust = signup(client, "cust@test.io")
    appt_id = book(client, cust, prov["service_id"], tomorrow_at(10)).json()["appointment"]["id"]
    r = client.post(f"/appointments/{appt_id}/cancel", headers=prov["headers"])
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled_by_provider"


def test_stranger_cannot_cancel(client, session):
    prov = make_provider(client, session)
    cust = signup(client, "cust@test.io")
    stranger = signup(client, "stranger@test.io")
    appt_id = book(client, cust, prov["service_id"], tomorrow_at(10)).json()["appointment"]["id"]
    assert client.post(f"/appointments/{appt_id}/cancel", headers=stranger).status_code == 403


def test_cancelled_slot_is_rebookable(client, session):
    prov = make_provider(client, session)
    a = signup(client, "a@test.io")
    b = signup(client, "b@test.io")
    appt_id = book(client, a, prov["service_id"], tomorrow_at(10)).json()["appointment"]["id"]
    client.post(f"/appointments/{appt_id}/cancel", headers=a)
    assert book(client, b, prov["service_id"], tomorrow_at(10)).status_code == 200


def test_deposit_booking_returns_checkout_url_and_holds_slot(client, session):
    prov = make_provider(client, session, deposit_cents=1000)
    a = signup(client, "a@test.io")
    b = signup(client, "b@test.io")
    r = book(client, a, prov["service_id"], tomorrow_at(10))
    assert r.status_code == 200
    body = r.json()
    assert body["checkout_url"] is not None
    assert body["payment_id"] is not None
    assert body["appointment"]["payment_status"] == "pending"
    # pending-payment slot is held inside the TTL
    assert book(client, b, prov["service_id"], tomorrow_at(10)).status_code == 409


def test_stub_confirm_flips_payment_to_paid(client, session):
    prov = make_provider(client, session, deposit_cents=1000)
    cust = signup(client, "cust@test.io")
    r = book(client, cust, prov["service_id"], tomorrow_at(10)).json()
    pay_id = r["payment_id"]
    rc = client.post(f"/payments/stub-confirm/{pay_id}", headers=cust)
    assert rc.status_code == 200
    assert rc.json()["status"] == "paid"
    mine = client.get("/appointments/mine", headers=cust).json()
    assert mine[0]["payment_status"] == "paid"
