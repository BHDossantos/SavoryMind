"""Tests for Scheduling + Time Clock (Restaurant OS Wave D)."""
from datetime import date, datetime, timedelta

from app.models.restaurant_ext import Staff, TimePunch
from app.models.user import User
from app.services import scheduling_service as sched, workforce_intelligence_service as wf

from .conftest import register_user, auth_headers


def _restaurant(db, **kw):
    defaults = dict(
        email=f"r{datetime.now().timestamp()}@example.com",
        password_hash="x", display_name="Trattoria D",
        restaurant_name="Trattoria D", account_type="restaurant",
        onboarding_completed=True,
    )
    defaults.update(kw)
    u = User(**defaults)
    db.add(u); db.commit(); db.refresh(u)
    return u


def _staff(db, user_id, name="Sam", shift="morning"):
    s = Staff(user_id=user_id, name=name, role="server", shift=shift, active=True)
    db.add(s); db.commit(); db.refresh(s)
    return s


def test_hours_between_normal_and_overnight():
    assert sched._hours_between("09:00", "17:00") == 8.0
    assert sched._hours_between("22:00", "02:00") == 4.0  # wraps midnight


def test_create_shift_and_week_view(db_session):
    rest = _restaurant(db_session)
    st = _staff(db_session, rest.id)
    monday = date.today() - timedelta(days=date.today().weekday())
    sched.create_shift(db_session, rest.id, staff_id=st.id, on_date=monday,
                       start_time="09:00", end_time="17:00")
    wk = sched.week_schedule(db_session, rest.id, monday)
    assert len(wk["days"][str(monday)]) == 1
    assert wk["staff_hours"][0]["hours"] == 8.0


def test_create_shift_unknown_staff(db_session):
    rest = _restaurant(db_session)
    monday = date.today()
    try:
        sched.create_shift(db_session, rest.id, staff_id=99999, on_date=monday,
                           start_time="09:00", end_time="17:00")
        assert False
    except sched.SchedulingError as e:
        assert e.status_code == 404


def test_clock_in_out_pairs_hours(db_session):
    rest = _restaurant(db_session)
    st = _staff(db_session, rest.id)
    t0 = datetime(2026, 7, 1, 9, 0, 0)
    sched.clock_in(db_session, rest.id, st.id, now=t0)
    p = sched.clock_out(db_session, rest.id, st.id, break_minutes=30, now=t0 + timedelta(hours=8))
    worked = (p.clock_out - p.clock_in).total_seconds() / 3600.0 - 0.5
    assert round(worked, 2) == 7.5


def test_double_clock_in_rejected(db_session):
    rest = _restaurant(db_session)
    st = _staff(db_session, rest.id)
    sched.clock_in(db_session, rest.id, st.id)
    try:
        sched.clock_in(db_session, rest.id, st.id)
        assert False
    except sched.SchedulingError:
        pass


def test_clock_out_without_in_rejected(db_session):
    rest = _restaurant(db_session)
    st = _staff(db_session, rest.id)
    try:
        sched.clock_out(db_session, rest.id, st.id)
        assert False
    except sched.SchedulingError:
        pass


def test_clock_status_lists_open(db_session):
    rest = _restaurant(db_session)
    st = _staff(db_session, rest.id, name="OnDuty")
    sched.clock_in(db_session, rest.id, st.id)
    status = sched.clock_status(db_session, rest.id)
    assert any(s["staff_name"] == "OnDuty" for s in status)


def test_hours_last_7_days(db_session):
    rest = _restaurant(db_session)
    st = _staff(db_session, rest.id)
    now = datetime.utcnow()
    # 3 closed 8h punches in the last 7 days (minus 0 break) = 24h
    for d in range(3):
        db_session.add(TimePunch(
            user_id=rest.id, staff_id=st.id,
            clock_in=now - timedelta(days=d, hours=8), clock_out=now - timedelta(days=d),
            break_minutes=0,
        ))
    db_session.commit()
    assert sched.hours_last_7_days(db_session, rest.id, st.id, now=now) == 24.0


def test_overtime_uses_real_punches(db_session):
    """A staffer with 42 clocked hours should be flagged as overtime even
    if their shift band would estimate under 40."""
    rest = _restaurant(db_session)
    st = _staff(db_session, rest.id, name="Mike", shift="morning")  # est 25h
    now = datetime.utcnow()
    # 6 x 7h closed punches = 42h clocked
    for d in range(6):
        db_session.add(TimePunch(
            user_id=rest.id, staff_id=st.id,
            clock_in=now - timedelta(days=d, hours=7), clock_out=now - timedelta(days=d),
        ))
    db_session.commit()
    out = wf.build(db_session, rest.id)
    mike = next((o for o in out["overtime_alerts"] if o["name"] == "Mike"), None)
    assert mike is not None
    assert mike["source"] == "clocked"


# --- Endpoint smoke tests ---

def test_schedule_endpoints(client, db_session):
    token, user = register_user(client, email="schedrest@example.com", account_type="restaurant")
    h = auth_headers(token)
    st = _staff(db_session, user["id"])
    monday = str(date.today() - timedelta(days=date.today().weekday()))
    res = client.post("/api/restaurant/schedule/shifts", headers=h, json={
        "staff_id": st.id, "date": monday, "start_time": "09:00", "end_time": "17:00",
    })
    assert res.status_code == 201, res.text
    sid = res.json()["id"]
    res = client.get("/api/restaurant/schedule", headers=h)
    assert res.status_code == 200
    res = client.delete(f"/api/restaurant/schedule/shifts/{sid}", headers=h)
    assert res.status_code == 204


def test_clock_endpoints(client, db_session):
    token, user = register_user(client, email="clockrest@example.com", account_type="restaurant")
    h = auth_headers(token)
    st = _staff(db_session, user["id"])
    res = client.post("/api/restaurant/clock/in", headers=h, json={"staff_id": st.id})
    assert res.status_code == 200, res.text
    res = client.get("/api/restaurant/clock/status", headers=h)
    assert len(res.json()["on_clock"]) == 1
    res = client.post("/api/restaurant/clock/out", headers=h, json={"staff_id": st.id, "break_minutes": 15})
    assert res.status_code == 200
    assert "hours_worked" in res.json()


def test_scheduling_requires_restaurant(client, db_session):
    token, _ = register_user(client, email="schedcons@example.com", account_type="consumer")
    res = client.get("/api/restaurant/schedule", headers=auth_headers(token))
    assert res.status_code == 403
