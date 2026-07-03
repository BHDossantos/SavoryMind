"""Tests for Operations — tasks + checklists (Restaurant OS Wave E)."""
from datetime import date, datetime, timedelta

from app.models.user import User
from app.services import operations_service as ops, action_plan_service

from .conftest import register_user, auth_headers


def _restaurant(db, **kw):
    defaults = dict(
        email=f"r{datetime.now().timestamp()}@example.com",
        password_hash="x", display_name="Trattoria E",
        restaurant_name="Trattoria E", account_type="restaurant",
        onboarding_completed=True,
    )
    defaults.update(kw)
    u = User(**defaults)
    db.add(u); db.commit(); db.refresh(u)
    return u


def test_create_task_and_today(db_session):
    rest = _restaurant(db_session)
    ops.create_task(db_session, rest.id, title="Sanitize prep station", due_date=date.today())
    view = ops.today_tasks(db_session, rest.id)
    assert view["open_count"] == 1
    assert view["open"][0]["title"] == "Sanitize prep station"


def test_create_task_validation(db_session):
    rest = _restaurant(db_session)
    try:
        ops.create_task(db_session, rest.id, title="  ")
        assert False
    except ops.OperationsError:
        pass


def test_toggle_done(db_session):
    rest = _restaurant(db_session)
    t = ops.create_task(db_session, rest.id, title="Count till", due_date=date.today())
    ops.set_done(db_session, rest.id, t.id, True)
    view = ops.today_tasks(db_session, rest.id)
    assert view["open_count"] == 0
    assert len(view["done"]) == 1
    ops.set_done(db_session, rest.id, t.id, False)
    assert ops.today_tasks(db_session, rest.id)["open_count"] == 1


def test_overdue_detection(db_session):
    rest = _restaurant(db_session)
    ops.create_task(db_session, rest.id, title="Late task", due_date=date.today() - timedelta(days=2))
    overdue = ops.overdue_tasks(db_session, rest.id)
    assert len(overdue) == 1


def test_checklist_create_and_instantiate(db_session):
    rest = _restaurant(db_session)
    tpl = ops.create_template(db_session, rest.id, name="Opening", category="opening",
                              items=["Unlock doors", "Turn on grill", "Check specials board"])
    assert len(tpl["items"]) == 3
    result = ops.instantiate(db_session, rest.id, tpl["id"])
    assert result["created"] == 3
    view = ops.today_tasks(db_session, rest.id)
    assert view["open_count"] == 3


def test_instantiate_unknown_checklist(db_session):
    rest = _restaurant(db_session)
    try:
        ops.instantiate(db_session, rest.id, 99999)
        assert False
    except ops.OperationsError as e:
        assert e.status_code == 404


def test_delete_template(db_session):
    rest = _restaurant(db_session)
    tpl = ops.create_template(db_session, rest.id, name="Closing", items=["Lock up"])
    assert ops.delete_template(db_session, rest.id, tpl["id"]) is True
    assert ops.list_templates(db_session, rest.id) == []


def test_action_plan_surfaces_overdue(db_session):
    rest = _restaurant(db_session)
    ops.create_task(db_session, rest.id, title="Fix walk-in seal", due_date=date.today() - timedelta(days=1))
    plan = action_plan_service.build_action_plan(db_session, rest)
    assert any(a["kind"] == "ops_overdue" for a in plan)


# --- Endpoints ---

def test_task_endpoints(client, db_session):
    token, _ = register_user(client, email="opsrest@example.com", account_type="restaurant")
    h = auth_headers(token)
    res = client.post("/api/restaurant/operations/tasks", headers=h,
                      json={"title": "Deep clean fryer", "category": "closing"})
    assert res.status_code == 201
    tid = res.json()["id"]
    res = client.patch(f"/api/restaurant/operations/tasks/{tid}?done=true", headers=h)
    assert res.json()["done"] is True
    res = client.get("/api/restaurant/operations/tasks", headers=h)
    assert res.status_code == 200
    res = client.delete(f"/api/restaurant/operations/tasks/{tid}", headers=h)
    assert res.status_code == 204


def test_checklist_endpoints(client, db_session):
    token, _ = register_user(client, email="opschk@example.com", account_type="restaurant")
    h = auth_headers(token)
    res = client.post("/api/restaurant/operations/checklists", headers=h,
                      json={"name": "Health & Safety", "category": "compliance",
                            "items": ["Fridge temps logged", "Handwash stocked"]})
    assert res.status_code == 201
    cid = res.json()["id"]
    res = client.post(f"/api/restaurant/operations/checklists/{cid}/instantiate", headers=h)
    assert res.json()["created"] == 2


def test_operations_requires_restaurant(client, db_session):
    token, _ = register_user(client, email="opscons@example.com", account_type="consumer")
    res = client.get("/api/restaurant/operations/tasks", headers=auth_headers(token))
    assert res.status_code == 403
