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
    # Allow any Cloud Run revision URL (e.g. https://savorymind-frontend-abc123-ew.a.run.app)
    # so the app keeps working before custom domains are wired up.
    cors_origin_regex: str = r"https://[a-z0-9-]+\.a\.run\.app$"
    secret_key: str = "savorymind-super-secret-change-in-production-32chars"
    algorithm: str = "HS256"
    access_token_expire_days: int = 30
    social_login_secret: str = "dev-social-secret"

    # Email (Resend). Empty string disables sends — useful in dev.
    resend_api_key: str = ""
    resend_from_email: str = "noreply@savorymind.net"

    # Error tracking (Sentry). Empty string disables Sentry entirely.
    sentry_dsn: str = ""
    sentry_environment: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()
