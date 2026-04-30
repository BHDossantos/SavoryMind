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


def test_register_mobile_client_returns_refresh_token_in_body(client):
    """X-Client-Type: mobile signals that the caller has no cookie jar
    (React Native fetch) and needs the refresh token in the JSON body so
    it can store it in SecureStore."""
    r = client.post(
        "/api/auth/register",
        headers={"X-Client-Type": "mobile"},
        json={
            "email": "mobile@example.com",
            "password": "password123",
            "display_name": "Mobile User",
            "account_type": "consumer",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["access_token"]
    assert body["refresh_token"], "mobile client must receive refresh in body"
    # Web client doesn't send the header → no refresh_token field
    r2 = client.post("/api/auth/register", json={
        "email": "web@example.com", "password": "password123",
        "display_name": "Web User", "account_type": "consumer",
    })
    assert r2.json().get("refresh_token") is None


def test_mobile_refresh_via_x_refresh_token_header(client):
    """Mobile flow: send the refresh token in the X-Refresh-Token header
    instead of relying on the cookie."""
    r = client.post(
        "/api/auth/register",
        headers={"X-Client-Type": "mobile"},
        json={"email": "m@example.com", "password": "password123",
              "display_name": "Mobile", "account_type": "consumer"},
    )
    refresh = r.json()["refresh_token"]
    assert refresh

    # Clear cookies so the cookie path can't satisfy the request
    client.cookies.clear()

    r = client.post(
        "/api/auth/refresh",
        headers={"X-Client-Type": "mobile", "X-Refresh-Token": refresh},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["access_token"]
    assert body["refresh_token"], "rotated refresh token must come back in body for mobile"


def test_mobile_logout_revokes_via_header(client):
    """Mobile logout: pass the refresh token via X-Refresh-Token. The
    server should revoke its jti so subsequent refreshes 401."""
    r = client.post(
        "/api/auth/register",
        headers={"X-Client-Type": "mobile"},
        json={"email": "m@example.com", "password": "password123",
              "display_name": "Mobile", "account_type": "consumer"},
    )
    refresh = r.json()["refresh_token"]

    out = client.post("/api/auth/logout", headers={"X-Refresh-Token": refresh})
    assert out.status_code == 204

    # Stolen-cookie replay (mobile flavour): cookie is gone, but the attacker
    # has the token value. Sending it back as the header must 401.
    client.cookies.clear()
    r = client.post(
        "/api/auth/refresh",
        headers={"X-Client-Type": "mobile", "X-Refresh-Token": refresh},
    )
    assert r.status_code == 401


def test_logout_revokes_jti_so_cookie_cant_be_reused(client):
    """The full point of jti revocation: after logout, presenting the same
    refresh cookie back to /refresh must 401, even though the JWT itself
    is still cryptographically valid for ~30 days."""
    register_user(client)
    stolen_cookie = client.cookies.get("sm_refresh")

    r = client.post("/api/auth/logout")
    assert r.status_code == 204

    # Re-attach the cookie that an attacker would have captured pre-logout
    client.cookies.set("sm_refresh", stolen_cookie)
    r = client.post("/api/auth/refresh")
    assert r.status_code == 401


def test_refresh_rotation_revokes_old_jti(client):
    """Token-family / replay detection: after a successful /refresh, the
    OLD cookie value must be unusable. Whoever has the old cookie (the
    attacker who stole it) gets 401 on next use."""
    register_user(client)
    old_cookie = client.cookies.get("sm_refresh")

    # Legitimate refresh — gets a new cookie
    r = client.post("/api/auth/refresh")
    assert r.status_code == 200
    new_cookie = client.cookies.get("sm_refresh")
    assert new_cookie != old_cookie

    # Attacker tries to replay the old cookie
    client.cookies.clear()
    client.cookies.set("sm_refresh", old_cookie)
    r = client.post("/api/auth/refresh")
    assert r.status_code == 401


def test_register_duplicate_email(client):
    register_user(client)
    r = client.post("/api/auth/register", json={
        "email": "alice@example.com",
        "password": "password123",
        "display_name": "Alice2",
        "account_type": "consumer",
    })
    assert r.status_code == 400
