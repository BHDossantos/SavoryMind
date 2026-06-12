"""Tests for the email verification flow (GSD task t-email-verify).

Verify steps from the task block:
  - signup leaves email_verified=False
  - /verify/{token} with the right token flips the flag
  - invalid / expired token returns 400
  - admin endpoints reject unverified
  - resend-verification generates a fresh token + email
  - bootstrap admin is verified by default (regression guard for dev login)
"""
from __future__ import annotations

from datetime import datetime, timedelta

import io
import pytest

from app.core.security import hash_password
from app.models import NotificationLog, User, Venue


def _wipe(d):
    """Truncate the rows my tests own. The conftest binds the engine to a
    shared file-based test DB so leakage between tests is real."""
    d.query(NotificationLog).delete()
    d.query(Venue).delete()
    d.query(User).delete()
    d.commit()


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("NOCTURNA_APP_BASE_URL", "http://localhost:3001")
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.db import SessionLocal

    with TestClient(app) as c:
        d = SessionLocal()
        _wipe(d)
        d.close()
        yield c
        d = SessionLocal()
        _wipe(d)
        d.close()


def _signup(client, email="u@example.com", password="pw", name="U"):
    r = client.post("/api/auth/register", json={"email": email, "password": password, "name": name})
    assert r.status_code == 200, r.text
    return r.json()


def _user_row(email="u@example.com") -> User:
    from app.core.db import SessionLocal
    d = SessionLocal()
    try:
        return d.query(User).filter(User.email == email).one()
    finally:
        d.close()


# Signup + token ------------------------------------------------------------


def test_signup_leaves_user_unverified(client):
    _signup(client)
    u = _user_row()
    assert u.email_verified is False
    assert u.email_verify_token is not None
    assert len(u.email_verify_token) >= 32
    assert u.email_verify_token_expires_at > datetime.utcnow()


def test_signup_sends_verify_email(client):
    _signup(client, name="Bruno")
    from app.core.db import SessionLocal
    d = SessionLocal()
    try:
        logs = d.query(NotificationLog).filter_by(channel="email").all()
        assert any("confirm your email" in (l.subject or "").lower() for l in logs)
        assert any("http://localhost:3001/verify/" in (l.body or "") for l in logs)
    finally:
        d.close()


def test_me_includes_email_verified(client):
    r = _signup(client)
    token = r["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert me["email_verified"] is False


# /verify/{token} -----------------------------------------------------------


def test_valid_token_verifies(client):
    _signup(client)
    u = _user_row()
    tok = u.email_verify_token

    r = client.get(f"/api/auth/verify/{tok}")
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True

    u2 = _user_row()
    assert u2.email_verified is True
    assert u2.email_verify_token is None  # cleared on success


def test_invalid_token_returns_400(client):
    _signup(client)
    r = client.get("/api/auth/verify/clearly-not-a-real-token")
    assert r.status_code == 400


def test_expired_token_returns_400_and_clears(client):
    _signup(client)
    # Force-expire the token directly in the DB.
    from app.core.db import SessionLocal
    d = SessionLocal()
    u = d.query(User).first()
    u.email_verify_token_expires_at = datetime.utcnow() - timedelta(minutes=1)
    d.commit()
    tok = u.email_verify_token
    d.close()

    r = client.get(f"/api/auth/verify/{tok}")
    assert r.status_code == 400

    # And the stale token should now be cleared so it can't be used again.
    u2 = _user_row()
    assert u2.email_verify_token is None
    assert u2.email_verified is False


# Resend --------------------------------------------------------------------


def test_resend_generates_new_token(client):
    r = _signup(client)
    auth = {"Authorization": f"Bearer {r['access_token']}"}
    u_before = _user_row()
    old_token = u_before.email_verify_token

    r2 = client.post("/api/auth/resend-verification", headers=auth)
    assert r2.status_code == 200
    assert r2.json()["ok"] is True

    u_after = _user_row()
    assert u_after.email_verify_token is not None
    assert u_after.email_verify_token != old_token

    # The old token must not work anymore now that the new one's in place.
    r3 = client.get(f"/api/auth/verify/{old_token}")
    assert r3.status_code == 400


def test_resend_noop_when_already_verified(client):
    r = _signup(client)
    auth = {"Authorization": f"Bearer {r['access_token']}"}
    u = _user_row()
    client.get(f"/api/auth/verify/{u.email_verify_token}")

    r2 = client.post("/api/auth/resend-verification", headers=auth)
    assert r2.status_code == 200
    assert r2.json()["already_verified"] is True


# Admin gate ----------------------------------------------------------------


def _make_admin(verified: bool) -> str:
    """Direct DB insert + return a JWT — bypassing /register so we can
    control the verified flag precisely."""
    from app.core.db import SessionLocal
    from app.core.security import create_access_token
    d = SessionLocal()
    try:
        u = User(
            email=f"admin-{verified}-{datetime.utcnow().timestamp()}@nocturna.app",
            password_hash=hash_password("pw"),
            role="admin",
            name="A",
            email_verified=verified,
        )
        d.add(u)
        d.commit()
        d.refresh(u)
        return create_access_token(str(u.id), role="admin")
    finally:
        d.close()


def test_admin_endpoint_rejects_unverified_admin(client):
    tok = _make_admin(verified=False)
    r = client.get("/api/admin/dashboard", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 403
    assert "not verified" in r.json()["detail"].lower()


def test_admin_endpoint_accepts_verified_admin(client):
    tok = _make_admin(verified=True)
    r = client.get("/api/admin/dashboard", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200


# Bootstrap admin regression -----------------------------------------------


def test_bootstrap_admin_is_verified(tmp_path):
    """The seed.bootstrap_admin path must produce a verified admin so dev
    login + the existing test_uploads admin fixture keep working."""
    from app.core.db import SessionLocal
    from app.seed.load_data import bootstrap_admin

    d = SessionLocal()
    try:
        _wipe(d)
        bootstrap_admin(d, "boot@nocturna.app", "pw")
        u = d.query(User).filter(User.email == "boot@nocturna.app").one()
        assert u.email_verified is True

        # Re-running the bootstrap on an existing (initially-unverified) admin
        # should auto-upgrade it.
        u.email_verified = False
        d.commit()
        bootstrap_admin(d, "boot@nocturna.app", "pw")
        u2 = d.query(User).filter(User.email == "boot@nocturna.app").one()
        assert u2.email_verified is True
        _wipe(d)
    finally:
        d.close()
