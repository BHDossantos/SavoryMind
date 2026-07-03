"""Tests for the Guest Intelligence (AI CRM) layer."""
from datetime import date, datetime, timedelta
from unittest.mock import patch

from app.models.restaurant_ext import Booking, CRMCustomer
from app.models.user import User
from app.services import guest_intelligence_service as gi

from .conftest import register_user, auth_headers


def _restaurant(db, **kw):
    defaults = dict(
        email=f"r{datetime.now().timestamp()}@example.com",
        password_hash="x", display_name="Trattoria GI",
        restaurant_name="Trattoria GI", account_type="restaurant",
        onboarding_completed=True, slug="trat-gi",
    )
    defaults.update(kw)
    u = User(**defaults)
    db.add(u); db.commit(); db.refresh(u)
    return u


def _cust(db, user_id, **kw):
    defaults = dict(user_id=user_id, name="Guest", total_visits=0, total_spend=0.0)
    defaults.update(kw)
    c = CRMCustomer(**defaults)
    db.add(c); db.commit(); db.refresh(c)
    return c


def test_segments_vip_and_high_spender(db_session):
    r = _restaurant(db_session)
    c = _cust(db_session, r.id, tags="vip,regular", total_spend=900, total_visits=10)
    segs = gi.segments_for(c, date.today())
    assert "vip" in segs
    assert "high_spender" in segs
    assert "frequent" in segs


def test_segments_inactive(db_session):
    r = _restaurant(db_session)
    c = _cust(db_session, r.id, total_visits=3, last_visit=date.today() - timedelta(days=60))
    assert "inactive" in gi.segments_for(c, date.today())


def test_segments_birthday_this_month(db_session):
    r = _restaurant(db_session)
    today = date.today()
    c = _cust(db_session, r.id, birthday=date(1990, today.month, 15))
    assert "birthday_this_month" in gi.segments_for(c, today)


def test_return_probability_recent_frequent_is_high(db_session):
    r = _restaurant(db_session)
    # 20 visits over ~140 days = ~7-day cadence; last visit 5 days ago.
    c = _cust(db_session, r.id, total_visits=20, last_visit=date.today() - timedelta(days=5))
    c.created_at = datetime.utcnow() - timedelta(days=140)
    db_session.commit()
    p = gi.return_probability(c, date.today())
    assert p >= 0.6


def test_return_probability_lapsed_is_low(db_session):
    r = _restaurant(db_session)
    # A frequent regular (10-day cadence) who then vanished for 200 days is
    # ~20 cadence-cycles overdue → strongly lapsed.
    c = _cust(db_session, r.id, total_visits=10, last_visit=date.today() - timedelta(days=200))
    c.created_at = datetime.utcnow() - timedelta(days=300)
    db_session.commit()
    p = gi.return_probability(c, date.today())
    assert p <= 0.3


def test_at_risk_ranks_by_value(db_session):
    r = _restaurant(db_session)
    # Valuable but lapsed
    _cust(db_session, r.id, name="Big Spender", total_visits=10, total_spend=2000,
          last_visit=date.today() - timedelta(days=50))
    # Cheap and lapsed
    _cust(db_session, r.id, name="Small", total_visits=3, total_spend=60,
          last_visit=date.today() - timedelta(days=50))
    # Active — should be excluded
    _cust(db_session, r.id, name="Active", total_visits=5, total_spend=500,
          last_visit=date.today() - timedelta(days=3))
    rows = gi.at_risk_guests(db_session, r.id)
    names = [x["name"] for x in rows]
    assert "Active" not in names
    assert names[0] == "Big Spender"  # highest value-at-stake first


def test_segments_endpoint(client, db_session):
    token, user = register_user(client, email="giseg@example.com", account_type="restaurant")
    _cust(db_session, user["id"], tags="vip", total_spend=900)
    res = client.get("/api/restaurant/crm/segments", headers=auth_headers(token))
    assert res.status_code == 200
    data = res.json()
    assert data["all"] >= 1
    assert data.get("vip", 0) >= 1


def test_at_risk_endpoint(client, db_session):
    token, user = register_user(client, email="girisk@example.com", account_type="restaurant")
    _cust(db_session, user["id"], name="Lapsed", total_visits=5, total_spend=800,
          last_visit=date.today() - timedelta(days=55))
    res = client.get("/api/restaurant/crm/at-risk", headers=auth_headers(token))
    assert res.status_code == 200
    assert len(res.json()["guests"]) == 1


def test_winback_draft_only(client, db_session):
    token, user = register_user(client, email="giwb@example.com", account_type="restaurant")
    c = _cust(db_session, user["id"], name="Marco", phone="+39111",
              favorite_dishes="Ribeye", total_visits=5, total_spend=800,
              last_visit=date.today() - timedelta(days=55))
    with patch("app.services.claude_client.is_configured", return_value=False), \
         patch("app.services.twilio_client.send_sms") as send:
        res = client.post(
            f"/api/restaurant/crm/{c.id}/winback",
            headers=auth_headers(token), json={"offer": "15% off a steak dinner", "send": False},
        )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["sms_body"]
    assert data["sent"] is False
    assert not send.called


def test_winback_send(client, db_session):
    token, user = register_user(client, email="giwb2@example.com", account_type="restaurant")
    c = _cust(db_session, user["id"], name="Marco", phone="+393334445566",
              favorite_dishes="Ribeye", total_visits=5, total_spend=800,
              last_visit=date.today() - timedelta(days=55))
    with patch("app.services.claude_client.is_configured", return_value=False), \
         patch("app.services.twilio_client.send_sms", return_value=True) as send:
        res = client.post(
            f"/api/restaurant/crm/{c.id}/winback",
            headers=auth_headers(token), json={"send": True},
        )
    assert res.status_code == 200
    assert res.json()["sent"] is True
    assert send.called


def test_loyalty_accrues_on_visit(client, db_session):
    token, user = register_user(client, email="giloy@example.com", account_type="restaurant")
    c = _cust(db_session, user["id"], name="Loyal")
    res = client.post(
        f"/api/restaurant/crm/{c.id}/visit?spend=90", headers=auth_headers(token),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["loyalty_points"] == 100  # 90 spend + 10 visit
    assert data["loyalty_tier"] == "bronze"


def test_timeline_endpoint(client, db_session):
    token, user = register_user(client, email="gitl@example.com", account_type="restaurant")
    c = _cust(db_session, user["id"], name="Marco", phone="+39111",
              last_visit=date.today() - timedelta(days=10))
    db_session.add(Booking(
        user_id=user["id"], customer_name="Marco", customer_phone="+39111",
        date=date.today() - timedelta(days=10), time_slot="19:00",
        party_size=2, status="completed",
    ))
    db_session.commit()
    res = client.get(f"/api/restaurant/crm/{c.id}/timeline", headers=auth_headers(token))
    assert res.status_code == 200
    events = res.json()["events"]
    assert any(e["type"] == "booking" for e in events)
