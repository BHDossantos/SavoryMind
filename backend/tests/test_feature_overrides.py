"""Per-account feature overrides — the deploy-free flag toggle (notes §5.2)."""
from app.core import entitlements
from app.models.feature_override import FeatureOverride
from app.models.user import User

from .conftest import register_user, auth_headers


def _restaurant(db_session, email, plan="free", tier=None):
    u = User(email=email, password_hash="x", display_name="R",
             account_type="restaurant", plan=plan)
    if tier:
        u.restaurant_tier = tier
    db_session.add(u); db_session.commit(); db_session.refresh(u)
    return u


def test_override_grants_locked_feature(db_session):
    u = _restaurant(db_session, "ov1@example.com", plan="free")   # starter tier
    # inventory is a pro feature — locked for a free/starter account.
    assert entitlements.has_feature(u, "inventory") is False
    ov = {"inventory": True}
    assert entitlements.has_feature(u, "inventory", ov) is True


def test_override_revokes_unlocked_feature(db_session):
    u = _restaurant(db_session, "ov2@example.com", plan="free")
    assert entitlements.has_feature(u, "crm") is True             # starter default
    assert entitlements.has_feature(u, "crm", {"crm": False}) is False


def test_overrides_map_reads_rows(db_session):
    u = _restaurant(db_session, "ov3@example.com")
    db_session.add_all([
        FeatureOverride(user_id=u.id, feature="inventory", enabled=True),
        FeatureOverride(user_id=u.id, feature="crm", enabled=False),
    ])
    db_session.commit()
    m = entitlements.overrides_map(db_session, u.id)
    assert m == {"inventory": True, "crm": False}


def test_entitlements_for_includes_overrides(db_session):
    u = _restaurant(db_session, "ov4@example.com", plan="free")
    ent = entitlements.entitlements_for(u, {"inventory": True})
    assert ent["features"]["inventory"] is True
    assert ent["overrides"] == {"inventory": True}


def test_entitlements_endpoint_applies_override(client, db_session):
    token, user = register_user(client, email="ov5@example.com", account_type="restaurant")
    # Default: free → starter, inventory locked.
    base = client.get("/api/billing/entitlements", headers=auth_headers(token)).json()
    assert base["features"]["inventory"] is False
    # Flip a DB row (the deploy-free toggle) and the endpoint reflects it.
    db_session.add(FeatureOverride(user_id=user["id"], feature="inventory", enabled=True))
    db_session.commit()
    after = client.get("/api/billing/entitlements", headers=auth_headers(token)).json()
    assert after["features"]["inventory"] is True
    assert after["overrides"]["inventory"] is True
