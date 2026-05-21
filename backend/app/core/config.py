import os
from pydantic_settings import BaseSettings


def _default_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if raw:
        try:
            import json
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
        return [o.strip() for o in raw.split(",") if o.strip()]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://savorymind.net",
        "https://www.savorymind.net",
        "https://app.savorymind.net",
        "https://api.savorymind.net",
    ]


class Settings(BaseSettings):
    app_name: str = "SavoryMind API"
    database_url: str = "sqlite:///./savorymind.db"
    cors_origins: list[str] = _default_cors_origins()
    # Cloud Run revision URLs for *this project's* frontend services only.
    # The previous regex (https://[a-z0-9-]+\.a\.run\.app$) accepted any Cloud
    # Run URL across all of GCP, which is far too broad — anyone with a Cloud
    # Run service could hit our API with credentials. This pattern requires
    # the savorymind- prefix on the service name.
    cors_origin_regex: str = r"https://savorymind-[a-z0-9-]+\.a\.run\.app$"
    secret_key: str = "savorymind-super-secret-change-in-production-32chars"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30
    social_login_secret: str = "dev-social-secret"

    # Refresh-token cookie. Defaults are safe for production; overridden by
    # env vars for local dev (no HTTPS, no shared parent domain).
    cookie_name: str = "sm_refresh"
    cookie_secure: bool = True
    cookie_samesite: str = "lax"  # "strict" would block the OAuth round-trip from /api/auth/...
    cookie_domain: str = ""        # empty = host-only; prod sets ".savorymind.net"
    cookie_path: str = "/"

    # Email (Resend). Empty string disables sends — useful in dev.
    resend_api_key: str = ""
    resend_from_email: str = "noreply@savorymind.net"

    # Error tracking (Sentry). Empty string disables Sentry entirely.
    sentry_dsn: str = ""
    sentry_environment: str = "development"

    # Spotify OAuth (real provider integration). Empty CLIENT_ID disables
    # the Spotify connect feature — endpoints respond with 503 so the UI can
    # gracefully fall back to the stub.
    # Register an app at developer.spotify.com → set the redirect URI to
    # SPOTIFY_REDIRECT_URI in the dashboard and provide both halves below.
    spotify_client_id: str = ""
    spotify_client_secret: str = ""
    spotify_redirect_uri: str = "http://localhost:8000/api/oauth/spotify/callback"
    # Where to send the user after Spotify redirects back to us. Path is
    # appended; defaults to the social-connect page.
    frontend_url: str = "http://localhost:3000"

    # Fernet key (32-byte url-safe base64) used to encrypt OAuth tokens at
    # rest in the social_connections table. The default below is for local
    # dev only — main.py refuses to start in production unless this is
    # overridden by the TOKEN_ENCRYPTION_KEY env var. Generate a new prod
    # key with: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
    token_encryption_key: str = "6oyaUCTF-qMyyC0mzvOkaXwmrt5RhYV_ZfIeiuRcXcI="

    # Google OAuth — Client ID of the Google OAuth app that mobile/web uses.
    # Required as the `aud` claim on Google-issued ID tokens; without it the
    # /api/auth/google endpoint refuses to verify (returns 503). Set on the
    # mobile/web side via EXPO_PUBLIC_GOOGLE_CLIENT_ID / GOOGLE_CLIENT_ID and
    # registered at console.cloud.google.com → APIs & Services → Credentials.
    google_client_id: str = ""

    # Apple Sign in — bundle identifier of the iOS app (e.g. "net.savorymind.app").
    # Used as the audience claim in Apple's ID token. Must match the
    # bundleIdentifier in mobile/app.json. App Store review rejects any app
    # offering Google sign-in unless Apple sign-in is also offered, so this
    # is required for iOS distribution. Web doesn't use Apple sign-in.
    apple_bundle_id: str = ""

    # Stripe billing — powers the consumer Premium subscription. Billing is
    # dormant until stripe_secret_key + stripe_price_id are set: checkout
    # endpoints return 503 and paywalled pages show the upgrade screen with
    # a "billing not available yet" message instead of a broken checkout.
    #   stripe_secret_key     — server-side API key (sk_live_… / sk_test_…)
    #   stripe_price_id       — recurring Price for the Premium plan, created
    #                           in the Stripe dashboard (price_…)
    #   stripe_webhook_secret — signing secret for POST /api/billing/webhook
    #                           (whsec_…); without it the webhook rejects all
    #                           events as unverified.
    stripe_secret_key: str = ""
    stripe_price_id: str = ""
    stripe_webhook_secret: str = ""
    # Where Stripe Checkout returns the user. Appended to frontend_url.
    stripe_success_path: str = "/consumer/upgrade?status=success"
    stripe_cancel_path: str = "/consumer/upgrade?status=cancel"

    class Config:
        env_file = ".env"


settings = Settings()
