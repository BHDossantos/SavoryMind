"""Pilots admin view — allowlist gating + funnel aggregation."""
import os
from unittest.mock import patch

from app.models.user import User
from app.services import coaching_service, loss_discovery_service

from .conftest import register_user, auth_headers


def test_pilots_403_when_allowlist_unset(client):
    token, _ = register_user(client, email="nobody@example.com", account_type="restaurant")
    # No ADMIN_EMAILS → dormant, 403 for everyone.
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("ADMIN_EMAILS", None)
        res = client.get("/api/admin/pilots", headers=auth_headers(token))
    assert res.status_code == 403


def test_pilots_403_for_non_admin(client):
    token, _ = register_user(client, email="regular@example.com", account_type="restaurant")
    with patch.dict(os.environ, {"ADMIN_EMAILS": "boss@savorymind.net"}):
        res = client.get("/api/admin/pilots", headers=auth_headers(token))
    assert res.status_code == 403


def test_pilots_returns_funnel_for_admin(client, db_session):
    token, owner = register_user(client, email="admin@savorymind.net", account_type="restaurant")
    row = db_session.query(User).filter(User.id == owner["id"]).first()
    row.onboarding_completed = True
    row.covers_per_day = 120; row.avg_ticket_eur = 35.0; row.staff_count = 8
    row.monthly_food_purchases_eur = 24000.0
    db_session.commit()
    # Produce an estimate + an incident so the row has real numbers.
    loss_discovery_service.run_estimate(db_session, row, audit={
        "waste_tracking": "never", "portion_control": "no_standard"})
    from app.models.restaurant_ext import Staff
    s = Staff(user_id=row.id, name="Carlos", role="chef", shift="evening")
    db_session.add(s); db_session.commit(); db_session.refresh(s)
    coaching_service.log_incident(db_session, row.id, staff_id=s.id, type="waste", euro_impact=50.0)

    with patch.dict(os.environ, {"ADMIN_EMAILS": "admin@savorymind.net"}):
        res = client.get("/api/admin/pilots", headers=auth_headers(token))
    assert res.status_code == 200
    body = res.json()
    assert body["totals"]["restaurants"] >= 1
    me = next(r for r in body["restaurants"] if r["id"] == owner["id"])
    assert me["onboarding_completed"] is True
    assert me["loss_band"] is not None
    assert me["incidents_30d"] == 1


def test_pilots_allowlist_is_case_insensitive(client):
    token, _ = register_user(client, email="Case@savorymind.net", account_type="restaurant")
    with patch.dict(os.environ, {"ADMIN_EMAILS": "case@savorymind.net"}):
        res = client.get("/api/admin/pilots", headers=auth_headers(token))
    assert res.status_code == 200
