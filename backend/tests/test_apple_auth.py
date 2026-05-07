"""Sign in with Apple endpoint tests.

Apple's first-sign-in quirk is the most important behavior to lock down:
the id_token NEVER includes name (and may omit email if user revoked
email sharing) — those come in the response body from the mobile client
on first sign-in only. Backend MUST persist them then or it'll never
have them.
"""
from unittest.mock import patch

from .conftest import register_user


def test_apple_login_returns_503_when_unconfigured(client, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.apple_bundle_id", "")
    r = client.post("/api/auth/apple", json={"id_token": "irrelevant"})
    assert r.status_code == 503


def test_apple_login_400_on_missing_token(client, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.apple_bundle_id", "net.savorymind.app")
    r = client.post("/api/auth/apple", json={})
    assert r.status_code == 400


def test_apple_login_401_on_invalid_token(client, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.apple_bundle_id", "net.savorymind.app")
    with patch("app.services.apple_oauth.verify_id_token") as v:
        from app.services.apple_oauth import AppleAuthError
        v.side_effect = AppleAuthError("Token expired.")
        r = client.post("/api/auth/apple", json={"id_token": "expired"})
    assert r.status_code == 401


def test_apple_login_creates_session_with_first_signin_payload(client, monkeypatch):
    """First sign-in: client passes name + email from response.fullName /
    response.email — these are NOT in the id_token. Backend persists
    them on the new user row."""
    monkeypatch.setattr("app.core.config.settings.apple_bundle_id", "net.savorymind.app")

    # First sign-in token: only sub claim (Apple omits name; may include
    # email or not depending on user choice).
    fake_claims = {
        "sub":  "001234.abcdefghijklmnop.5678",
        "iss":  "https://appleid.apple.com",
        "aud":  "net.savorymind.app",
        "exp":  9999999999,
        "email_verified": True,
        # email is in the body, not the token, in this test scenario
    }

    with patch("app.services.apple_oauth.verify_id_token", return_value=fake_claims):
        r = client.post(
            "/api/auth/apple",
            headers={"X-Client-Type": "mobile"},
            json={
                "id_token": "anything",
                "name":     "Alice Example",
                "email":    "alice@privaterelay.appleid.com",
            },
        )

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["access_token"]
    # Display name comes from the body (Apple doesn't put it in the token).
    assert body["user"]["display_name"] == "Alice Example"
    assert body["user"]["email"] == "alice@privaterelay.appleid.com"
    # Mobile client gets refresh in body
    assert body["refresh_token"]


def test_apple_login_subsequent_signin_uses_existing_user(client, db_session, monkeypatch):
    """Subsequent sign-ins: only sub claim, no body name/email. Existing
    user row's data is used unchanged. This is the steady-state flow."""
    monkeypatch.setattr("app.core.config.settings.apple_bundle_id", "net.savorymind.app")

    # First sign-in to create the user
    first_claims = {
        "sub": "001234.repeated.user.789",
        "iss": "https://appleid.apple.com",
        "aud": "net.savorymind.app",
        "exp": 9999999999,
        "email_verified": True,
    }
    with patch("app.services.apple_oauth.verify_id_token", return_value=first_claims):
        client.post(
            "/api/auth/apple",
            json={"id_token": "first", "name": "Bob", "email": "bob@example.com"},
        )

    # Second sign-in: token has only sub (Apple's design), body has no name/email
    with patch("app.services.apple_oauth.verify_id_token", return_value=first_claims):
        r = client.post("/api/auth/apple", json={"id_token": "second"})

    assert r.status_code == 200, r.text
    body = r.json()
    # User identity preserved from first sign-in
    assert body["user"]["email"] == "bob@example.com"
    assert body["user"]["display_name"] == "Bob"


def test_apple_login_handles_email_omitted_entirely(client, monkeypatch):
    """User revoked email sharing for this app → no email in token AND
    no email in body. social_login mints an apple_<sub>@social
    placeholder, account still works."""
    monkeypatch.setattr("app.core.config.settings.apple_bundle_id", "net.savorymind.app")

    fake_claims = {
        "sub":  "no.email.user.111",
        "iss":  "https://appleid.apple.com",
        "aud":  "net.savorymind.app",
        "exp":  9999999999,
    }
    with patch("app.services.apple_oauth.verify_id_token", return_value=fake_claims):
        r = client.post("/api/auth/apple", json={"id_token": "tok", "name": "Anonymous"})

    assert r.status_code == 200
    body = r.json()
    # Placeholder email — pattern matches social_login's no-email branch
    assert "@social" in body["user"]["email"]


def test_apple_login_links_to_existing_email_account(client, monkeypatch):
    """If a user already registered with email/password using their
    Apple-shared email, signing in with Apple should link the social
    identity to the existing account, not create a duplicate."""
    monkeypatch.setattr("app.core.config.settings.apple_bundle_id", "net.savorymind.app")

    # Pre-register a password account
    register_user(client, email="linker@example.com")

    fake_claims = {
        "sub":  "link.test.444",
        "iss":  "https://appleid.apple.com",
        "aud":  "net.savorymind.app",
        "exp":  9999999999,
        "email_verified": True,
    }
    with patch("app.services.apple_oauth.verify_id_token", return_value=fake_claims):
        r = client.post(
            "/api/auth/apple",
            json={"id_token": "tok", "name": "Pre-existing user", "email": "linker@example.com"},
        )

    assert r.status_code == 200
    body = r.json()
    assert body["user"]["email"] == "linker@example.com"
