"""Tests for Workforce Intelligence (Restaurant OS Wave B)."""
from datetime import date, datetime, timedelta

from app.models.restaurant_ext import Staff
from app.models.user import User
from app.services import workforce_intelligence_service as wf

from .conftest import register_user, auth_headers


def _restaurant(db, **kw):
    defaults = dict(
        email=f"r{datetime.now().timestamp()}@example.com",
        password_hash="x", display_name="Trattoria WF",
        restaurant_name="Trattoria WF", account_type="restaurant",
        onboarding_completed=True,
    )
    defaults.update(kw)
    u = User(**defaults)
    db.add(u); db.commit(); db.refresh(u)
    return u


def _staff(db, user_id, **kw):
    defaults = dict(user_id=user_id, name="Sam", role="server", shift="full",
                    rating=4.5, punctuality_score=100.0, orders_handled=50, active=True)
    defaults.update(kw)
    s = Staff(**defaults)
    db.add(s); db.commit(); db.refresh(s)
    return s


def test_overtime_flagged_for_full_shift(db_session):
    rest = _restaurant(db_session)
    _staff(db_session, rest.id, name="Mike", shift="full")  # 45h est → overtime
    out = wf.build(db_session, rest.id)
    names = [o["name"] for o in out["overtime_alerts"]]
    assert "Mike" in names


def test_part_shift_not_overtime(db_session):
    rest = _restaurant(db_session)
    _staff(db_session, rest.id, name="Pat", shift="morning")  # 25h → no OT
    out = wf.build(db_session, rest.id)
    assert all(o["name"] != "Pat" for o in out["overtime_alerts"])


def test_attrition_flagged_on_low_signals(db_session):
    rest = _restaurant(db_session)
    _staff(db_session, rest.id, name="Sarah", rating=3.0, punctuality_score=70.0, orders_handled=5)
    out = wf.build(db_session, rest.id)
    risks = out["attrition_risks"]
    assert risks and risks[0]["name"] == "Sarah"
    assert risks[0]["confidence"] >= 0.4
    assert risks[0]["reasons"]


def test_strong_performer_not_flagged(db_session):
    rest = _restaurant(db_session)
    _staff(db_session, rest.id, name="Ace", rating=4.9, punctuality_score=99.0, orders_handled=120)
    out = wf.build(db_session, rest.id)
    assert all(r["name"] != "Ace" for r in out["attrition_risks"])


def test_inactive_staff_excluded(db_session):
    rest = _restaurant(db_session)
    _staff(db_session, rest.id, name="Gone", active=False, rating=2.0,
           punctuality_score=50.0, orders_handled=0, shift="full")
    out = wf.build(db_session, rest.id)
    assert all(r["name"] != "Gone" for r in out["attrition_risks"])
    assert all(o["name"] != "Gone" for o in out["overtime_alerts"])


def test_staffing_suggestion_present(db_session):
    rest = _restaurant(db_session)
    _staff(db_session, rest.id)
    out = wf.build(db_session, rest.id)
    assert "staffing_suggestion" in out


def test_endpoint_requires_restaurant(client, db_session):
    token, _ = register_user(client, email="wfcons@example.com", account_type="consumer")
    res = client.get("/api/restaurant/staff/intelligence", headers=auth_headers(token))
    assert res.status_code == 403


def test_endpoint_happy(client, db_session):
    token, user = register_user(client, email="wfrest@example.com", account_type="restaurant")
    _staff(db_session, user["id"], name="Mike", shift="full")
    res = client.get("/api/restaurant/staff/intelligence", headers=auth_headers(token))
    assert res.status_code == 200
    data = res.json()
    assert "overtime_alerts" in data and "attrition_risks" in data


def test_action_plan_surfaces_workforce(client, db_session):
    """A flight-risk staffer should appear as an Action Plan card."""
    from app.services import action_plan_service
    rest = _restaurant(db_session, email="wfap@example.com")
    _staff(db_session, rest.id, name="Sarah", rating=2.8, punctuality_score=65.0, orders_handled=3)
    plan = action_plan_service.build_action_plan(db_session, rest)
    assert any(a["kind"] == "attrition_risk" for a in plan)
