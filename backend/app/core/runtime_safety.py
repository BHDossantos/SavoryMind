"""Fail closed when a hosted service accidentally inherits local defaults."""

import os
from urllib.parse import urlsplit


DEFAULT_SECRET = "savorymind-super-secret-change-in-production-32chars"
DEFAULT_SOCIAL_SECRET = "dev-social-secret"
DEFAULT_TOKEN_ENCRYPTION_KEY = "6oyaUCTF-qMyyC0mzvOkaXwmrt5RhYV_ZfIeiuRcXcI="


def validate_runtime(settings, environ=None):
    """Validate before migrations, seed data or scheduled actions can run.

    A database's type must never be the sole signal for production: missing
    DATABASE_URL used to select SQLite and disable every secret guard on Render.
    Keep the historical non-SQLite guard for existing unmanaged deployments.
    """
    env = os.environ if environ is None else environ
    url = settings.database_url.strip()
    scheme = urlsplit(url).scheme.lower()
    sqlite = scheme.split("+", 1)[0] == "sqlite"
    hosted = bool(env.get("RENDER_SERVICE_ID") or env.get("K_SERVICE"))
    explicit = str(getattr(settings, "app_env", "")).strip().lower() in {"production", "prod"}
    sentry_prod = str(getattr(settings, "sentry_environment", "")).strip().lower() == "production"
    production = hosted or explicit or sentry_prod or not sqlite
    if not production:
        return False
    if not url or sqlite:
        raise RuntimeError(
            "Production requires an explicitly configured durable DATABASE_URL; "
            "the local SQLite fallback is not supported. Verify and preserve "
            "existing data before changing the database configuration."
        )
    for name, default in (
        ("secret_key", DEFAULT_SECRET),
        ("social_login_secret", DEFAULT_SOCIAL_SECRET),
        ("token_encryption_key", DEFAULT_TOKEN_ENCRYPTION_KEY),
    ):
        value = getattr(settings, name, "")
        if not value or not value.strip() or value.strip() == default:
            raise RuntimeError(
                f"{name.upper()} must be configured with a non-default value in production."
            )
    return True
