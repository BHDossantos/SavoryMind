"""Tests for the audit's architectural items: entitlements + roles + audit log."""
from app.core import entitlements, roles as roles_mod
from app.models.user import User
from app.services import audit_log_service

from .conftest import register_user, auth_headers


def test_starter_tier_has_baseline_features():
    u = User(plan="free", account_type="restaurant", role="owner")
    e = entitlements.entitlements_for(u)
    assert e["tier"] == "starter"
    assert e["features"]["crm"] is True
    assert e["features"]["menu_broadcast"] is True
    assert e["features"]["campaigns"] is False
    assert e["features"]["inventory"] is False


def test_growth_tier_unlocks_marketing_waste_reports():
    u = User(plan="pro", account_type="restaurant", role="owner", restaurant_tier="growth")
    assert entitlements.has_feature(u, "campaigns")
    assert entitlements.has_feature(u, "food_waste")
    assert entitlements.has_feature(u, "reports")
    assert not entitlements.has_feature(u, "inventory")


def test_pro_tier_unlocks_everything():
    u = User(plan="pro", account_type="restaurant", role="owner", restaurant_tier="pro")
    for f in entitlements.FEATURE_MIN_TIER:
        assert entitlements.has_feature(u, f), f


def test_legacy_paying_user_gets_pro_fallback():
    """A pre-existing 'pro' plan with no restaurant_tier set falls back
    to pro entitlements so the pilot keeps working."""
    u = User(plan="pro", account_type="restaurant", role="owner")
    assert entitlements.has_feature(u, "inventory")


def test_role_can_blocks_marketer_from_inventory():
    marketer = User(role="marketer")
    assert roles_mod.can(marketer, "marketing.write")
    assert not roles_mod.can(marketer, "inventory.write")


def test_role_owner_can_everything():
    owner = User(role="owner")
    for perm in roles_mod.PERMISSIONS:
        assert roles_mod.can(owner, perm), perm


def test_audit_log_records_and_lists(client, db_session):
    token, user = register_user(client, email="audit@example.com", account_type="restaurant")
    audit_log_service.record(
        db_session, actor_user_id=user["id"], tenant_user_id=user["id"],
        action="booking.delete", target="booking:42", metadata={"reason": "duplicate"},
    )
    audit_log_service.record(
        db_session, actor_user_id=user["id"], tenant_user_id=user["id"],
        action="menu.publish", target="menu_of_the_day",
    )
    res = client.get("/api/restaurant/audit-log", headers=auth_headers(token))
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 2
    # Newest first
    assert items[0]["action"] == "menu.publish"


def test_audit_log_blocked_for_non_manager_role(client, db_session):
    token, user = register_user(client, email="serveraud@example.com", account_type="restaurant")
    # Demote
    u = db_session.query(User).filter(User.id == user["id"]).first()
    u.role = "server"
    db_session.commit()
    res = client.get("/api/restaurant/audit-log", headers=auth_headers(token))
    assert res.status_code == 403


def test_entitlements_endpoint(client, db_session):
    token, _ = register_user(client, email="entit@example.com", account_type="restaurant")
    res = client.get("/api/billing/entitlements", headers=auth_headers(token))
    assert res.status_code == 200
    data = res.json()
    assert "tier" in data and "features" in data
