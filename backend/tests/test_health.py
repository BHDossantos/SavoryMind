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
    monkeypatch.setattr(settings, "resend_api_key", "re-do-not-leak")
    monkeypatch.setattr(settings, "stripe_secret_key", "sk-stripe-leak")
    monkeypatch.setattr(settings, "stripe_price_id", "price-leak")
    monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec-leak")
    monkeypatch.setattr(settings, "stripe_restaurant_price_id", "price-rest-leak")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-do-not-leak")
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC-twilio-leak")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN",  "twilio-tok-leak")
    monkeypatch.setenv("TWILIO_FROM_PHONE",  "+1555555TWILIO")
    monkeypatch.setenv("POSTHOG_API_KEY", "ph-posthog-leak")
    monkeypatch.setenv("SCHEDULER_SERVICE_ACCOUNT", "sched@leak.iam")
    monkeypatch.setenv("SCHEDULER_AUDIENCE",        "leak-audience")

    access, _ = register_user(client)
    r = client.get("/health/deep", headers=auth_headers(access))
    serialized = r.text
    for sensitive in [
        "secret-id-do-not-leak", "secret-value-do-not-leak", "google-id-do-not-leak",
        "jwt-signing-do-not-leak", "fernet-do-not-leak", "sk-do-not-leak", "leak@sentry",
        "re-do-not-leak", "sk-stripe-leak", "price-leak", "whsec-leak", "price-rest-leak",
        "AC-twilio-leak", "twilio-tok-leak", "+1555555TWILIO",
        "ph-posthog-leak", "sched@leak.iam", "leak-audience",
    ]:
        assert sensitive not in serialized, f"{sensitive} leaked into /health/deep response"


# ── Pilot integrations (added when the launch surface grew past the original 5) ──

def test_health_deep_resend_dormant_by_default(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "resend_api_key", "")
    access, _ = register_user(client)
    assert client.get("/health/deep", headers=auth_headers(access)).json()["integrations"]["resend"] == "dormant"


def test_health_deep_resend_enabled_when_set(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "resend_api_key", "re_test_dummy")
    access, _ = register_user(client)
    assert client.get("/health/deep", headers=auth_headers(access)).json()["integrations"]["resend"] == "enabled"


def test_health_deep_twilio_flags_half_configured(client, monkeypatch):
    """All three Twilio env vars are needed for SMS to send. Two-of-three
    is the silent-failure mode worth catching at deploy time."""
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC_dummy")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "tok_dummy")
    monkeypatch.delenv("TWILIO_FROM_PHONE", raising=False)
    access, _ = register_user(client)
    assert client.get("/health/deep", headers=auth_headers(access)).json()["integrations"]["twilio"] == "misconfigured"


def test_health_deep_twilio_enabled_when_all_three_set(client, monkeypatch):
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC_dummy")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "tok_dummy")
    monkeypatch.setenv("TWILIO_FROM_PHONE", "+15555550100")
    access, _ = register_user(client)
    assert client.get("/health/deep", headers=auth_headers(access)).json()["integrations"]["twilio"] == "enabled"


def test_health_deep_stripe_consumer_enabled_when_full_set(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test")
    monkeypatch.setattr(settings, "stripe_price_id", "price_consumer")
    monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_test")
    access, _ = register_user(client)
    assert client.get("/health/deep", headers=auth_headers(access)).json()["integrations"]["stripe_consumer"] == "enabled"


def test_health_deep_stripe_consumer_flags_missing_webhook(client, monkeypatch):
    """Secret + Price set but webhook missing — checkout works, but the
    webhook can never verify, so entitlement never flips. Real bug worth
    surfacing at /health/deep rather than at first successful payment."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test")
    monkeypatch.setattr(settings, "stripe_price_id", "price_consumer")
    monkeypatch.setattr(settings, "stripe_webhook_secret", "")
    access, _ = register_user(client)
    assert client.get("/health/deep", headers=auth_headers(access)).json()["integrations"]["stripe_consumer"] == "misconfigured"


def test_health_deep_stripe_restaurant_independent(client, monkeypatch):
    """Restaurant Price wired but consumer Price unset — restaurant
    billing should still report enabled."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test")
    monkeypatch.setattr(settings, "stripe_price_id", "")
    monkeypatch.setattr(settings, "stripe_restaurant_price_id", "price_restaurant")
    monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_test")
    access, _ = register_user(client)
    integ = client.get("/health/deep", headers=auth_headers(access)).json()["integrations"]
    assert integ["stripe_restaurant"] == "enabled"
    assert integ["stripe_consumer"]   == "misconfigured"  # secret + webhook set without price


def test_health_deep_apple_signin(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "apple_bundle_id", "net.savorymind.app")
    access, _ = register_user(client)
    assert client.get("/health/deep", headers=auth_headers(access)).json()["integrations"]["apple_signin"] == "enabled"


def test_health_deep_posthog_and_scheduler(client, monkeypatch):
    monkeypatch.setenv("POSTHOG_API_KEY", "phc_test")
    monkeypatch.setenv("SCHEDULER_SERVICE_ACCOUNT", "sched@example.iam.gserviceaccount.com")
    monkeypatch.setenv("SCHEDULER_AUDIENCE", "https://api.savorymind.net")
    access, _ = register_user(client)
    integ = client.get("/health/deep", headers=auth_headers(access)).json()["integrations"]
    assert integ["posthog"]         == "enabled"
    assert integ["cloud_scheduler"] == "enabled"


def test_health_deep_scheduler_flags_half_configured(client, monkeypatch):
    """SA email set but audience missing → every /internal/jobs/* 503s
    silently. Surface it loudly here."""
    monkeypatch.setenv("SCHEDULER_SERVICE_ACCOUNT", "sched@example.iam.gserviceaccount.com")
    monkeypatch.delenv("SCHEDULER_AUDIENCE", raising=False)
    access, _ = register_user(client)
    assert client.get("/health/deep", headers=auth_headers(access)).json()["integrations"]["cloud_scheduler"] == "misconfigured"


def test_health_deep_pilot_integrations_dormant_by_default(client, monkeypatch):
    """Smoke check: a vanilla dev env reports every pilot integration as
    dormant. If a future deploy regression leaves any of these in a
    half-configured state at boot, this test flags it."""
    from app.core.config import settings
    for key in ("resend_api_key", "stripe_secret_key", "stripe_price_id",
                "stripe_webhook_secret", "stripe_restaurant_price_id",
                "apple_bundle_id"):
        monkeypatch.setattr(settings, key, "")
    for envkey in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_PHONE",
                   "POSTHOG_API_KEY", "SCHEDULER_SERVICE_ACCOUNT", "SCHEDULER_AUDIENCE"):
        monkeypatch.delenv(envkey, raising=False)

    access, _ = register_user(client)
    integ = client.get("/health/deep", headers=auth_headers(access)).json()["integrations"]
    for k in ("resend", "twilio", "stripe_consumer", "stripe_restaurant",
              "posthog", "apple_signin", "cloud_scheduler"):
        assert integ[k] == "dormant", f"{k} should be dormant in vanilla env, got {integ[k]}"
