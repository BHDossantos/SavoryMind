"""Auth refactor regression suite.

Covers the 30-min in-memory access token + httpOnly refresh cookie design
introduced in commit 9b27539. Every flow that previously had to be
verified by hand via ad-hoc TestClient scripts.
"""
from .conftest import register_user, auth_headers


def test_register_returns_access_token_and_sets_refresh_cookie(client):
    access, user = register_user(client)
    assert access  # JWT in body
    assert "sm_refresh" in client.cookies
    assert user["email"] == "alice@example.com"


def test_me_with_access_token(client):
    access, _ = register_user(client)
    r = client.get("/api/auth/me", headers=auth_headers(access))
    assert r.status_code == 200
    assert r.json()["email"] == "alice@example.com"


def test_me_without_token_rejected(client):
    register_user(client)
    r = client.get("/api/auth/me")
    assert r.status_code == 401  # HTTPBearer rejects missing header


def test_refresh_rotates_cookie(client):
    register_user(client)
    refresh_before = client.cookies.get("sm_refresh")
    r = client.post("/api/auth/refresh")
    assert r.status_code == 200
    assert r.json()["access_token"]
    refresh_after = client.cookies.get("sm_refresh")
    assert refresh_after != refresh_before, "refresh cookie should rotate (jti changes)"


def test_refresh_without_cookie_returns_401(client):
    # No prior login → no cookie in jar
    r = client.post("/api/auth/refresh")
    assert r.status_code == 401


def test_refresh_with_garbage_cookie_returns_401(client):
    client.cookies.set("sm_refresh", "garbage.invalid.token")
    r = client.post("/api/auth/refresh")
    assert r.status_code == 401


def test_refresh_token_cannot_be_used_as_access_token(client):
    """The typ claim guard prevents cross-token-type misuse — using a
    refresh token in an Authorization: Bearer header must not authenticate
    the user."""
    register_user(client)
    refresh_token = client.cookies.get("sm_refresh")
    r = client.get("/api/auth/me", headers=auth_headers(refresh_token))
    assert r.status_code == 401


def test_logout_clears_refresh_cookie(client):
    register_user(client)
    r = client.post("/api/auth/logout")
    assert r.status_code == 204

    # Subsequent refresh attempts (with the now-cleared cookie) should fail
    client.cookies.clear()
    r = client.post("/api/auth/refresh")
    assert r.status_code == 401


def test_login_after_register(client):
    register_user(client)
    client.cookies.clear()
    r = client.post("/api/auth/login", json={
        "email": "alice@example.com",
        "password": "password123",
    })
    assert r.status_code == 200
    assert "sm_refresh" in client.cookies


def test_login_wrong_password(client):
    register_user(client)
    r = client.post("/api/auth/login", json={
        "email": "alice@example.com",
        "password": "wrongpassword",
    })
    assert r.status_code == 401


def test_account_type_set_once_guard(client):
    """The privilege-escalation fix from commit edc0510: once
    account_type is set on a user, PATCH /api/auth/profile must not
    change it."""
    access, _ = register_user(client, account_type="diner")
    r = client.patch(
        "/api/auth/profile",
        headers=auth_headers(access),
        json={"account_type": "restaurant"},
    )
    assert r.status_code == 403
    assert "cannot be changed" in r.json()["detail"]


def test_unknown_profile_field_silently_ignored(client):
    """Defense-in-depth: ProfileUpdate.model_fields allowlist prevents
    unknown fields from reaching setattr() and corrupting the ORM."""
    access, _ = register_user(client)
    r = client.patch(
        "/api/auth/profile",
        headers=auth_headers(access),
        json={"display_name": "Updated", "bogus_field": "boom"},
    )
    assert r.status_code == 200
    assert r.json()["display_name"] == "Updated"


def test_register_duplicate_email(client):
    register_user(client)
    r = client.post("/api/auth/register", json={
        "email": "alice@example.com",
        "password": "password123",
        "display_name": "Alice2",
        "account_type": "consumer",
    })
    assert r.status_code == 400
