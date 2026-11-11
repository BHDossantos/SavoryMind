from typing import Literal
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: Literal["development", "test", "production"] = "development"
    integrations_mode: Literal["stub", "live"] = "stub"
    database_url: str = "sqlite:///./slotly.db"
    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    cors_origins: str = "http://localhost:3001,http://localhost:3000"
    frontend_url: str = "http://localhost:3001"
    stripe_secret_key: str = ""  # empty = stub mode (no real Stripe calls)
    stripe_webhook_secret: str = ""
    pending_payment_ttl_minutes: int = 15
    resend_api_key: str = ""  # empty = stub mode (no real sends)
    notifications_from_email: str = "noreply@slotly.app"
    notifications_from_name: str = "Slotly"
    notifications_tick_seconds: int = 60
    # Phase 07 — auto-fill cancellations
    auto_fill_lookback_days: int = 14
    auto_fill_max_recipients: int = 20
    auto_fill_user_rate_limit_hours: int = 24

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def validate_runtime(self):
        if self.environment == "production":
            if self.integrations_mode != "live":
                raise ValueError("Production must not use simulated payments or email")
            if self.jwt_secret == "change-me-in-prod" or len(self.jwt_secret) < 32:
                raise ValueError("Production requires a strong JWT_SECRET of at least 32 characters")
            if not self.frontend_url.startswith("https://") or "*" in self.cors_origin_list:
                raise ValueError("Production requires HTTPS frontend and explicit CORS origins")
        if self.integrations_mode == "live" and not all((self.stripe_secret_key, self.stripe_webhook_secret, self.resend_api_key)):
            raise ValueError("Live integrations require Stripe, webhook and Resend credentials")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
