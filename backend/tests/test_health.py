"""/health endpoint regression suite (commit fb2cbbd).

Verifies the readiness probe returns 200 when DB is reachable and does
not leak DB exception strings to clients.
"""
from .conftest import register_user, auth_headers


def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    # Must not include the raw exception string (the original audit
    # finding — db_error: "...connection refused..." was being returned
    # to anonymous clients).
    assert "db_error" not in body


def test_root_ok(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "docs" in r.json()


def test_health_deep_requires_auth(client):
    r = client.get("/health/deep")
    # HTTPBearer rejects missing header with 401.
    assert r.status_code == 401


def test_health_deep_returns_integration_states(client, monkeypatch):
    """Deploy-time diagnostic returns enabled/dormant/misconfigured per
    integration. Crucial that misconfigured (half-set Spotify pair) is
    distinguishable from dormant (both unset)."""
    # Test default: no Spotify, no Google. Sentry/Anthropic stay env-var-driven.
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    from app.core.config import settings
    monkeypatch.setattr(settings, "spotify_client_id", "")
    monkeypatch.setattr(settings, "spotify_client_secret", "")
    monkeypatch.setattr(settings, "google_client_id", "")
    monkeypatch.setattr(settings, "sentry_dsn", "")

    access, _ = register_user(client)
    r = client.get("/health/deep", headers=auth_headers(access))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "ok"
    assert body["db"] == "ok"
    integ = body["integrations"]
    assert integ["spotify"]   == "dormant"
    assert integ["google_signin"] == "dormant"
    assert integ["anthropic"] == "dormant"
    assert integ["sentry"]    == "dormant"
    # Token encryption key on test env is the dev default
    assert integ["token_encryption"] == "dev_key"
    # Policy snapshot — verifies env plumbing without leaking values
    assert "access_token_expire_minutes" in body["policy"]
    assert isinstance(body["policy"]["cookie_secure"], bool)


def test_health_deep_flags_half_configured_spotify(client, monkeypatch):
    """The most common Spotify config bug: CLIENT_ID set but
    CLIENT_SECRET missing (or vice-versa). Without distinguishing
    'misconfigured' from 'dormant', this state silently 500s on the
    first OAuth callback. /health/deep surfaces it loudly at deploy time."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "spotify_client_id", "configured")
    monkeypatch.setattr(settings, "spotify_client_secret", "")
    access, _ = register_user(client)
    r = client.get("/health/deep", headers=auth_headers(access))
    assert r.json()["integrations"]["spotify"] == "misconfigured"


def test_health_deep_does_not_leak_secret_values(client, monkeypatch):
    """Defense-in-depth: even if a future contributor adds a field that
    accidentally exposes a secret, this test fails. None of the
    sensitive env vars should appear verbatim in the response body."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "spotify_client_id", "secret-id-do-not-leak")
    monkeypatch.setattr(settings, "spotify_client_secret", "secret-value-do-not-leak")
    monkeypatch.setattr(settings, "google_client_id", "google-id-do-not-leak")
    monkeypatch.setattr(settings, "secret_key", "jwt-signing-do-not-leak")
    monkeypatch.setattr(settings, "token_encryption_key", "fernet-do-not-leak")
    monkeypatch.setattr(settings, "sentry_dsn", "https://leak@sentry.io/1")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-do-not-leak")

    access, _ = register_user(client)
    r = client.get("/health/deep", headers=auth_headers(access))
    serialized = r.text
    for sensitive in [
        "secret-id-do-not-leak", "secret-value-do-not-leak", "google-id-do-not-leak",
        "jwt-signing-do-not-leak", "fernet-do-not-leak", "sk-do-not-leak", "leak@sentry",
    ]:
        assert sensitive not in serialized, f"{sensitive} leaked into /health/deep response"
