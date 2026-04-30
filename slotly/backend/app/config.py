from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
