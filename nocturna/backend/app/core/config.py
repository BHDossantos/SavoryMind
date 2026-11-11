from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings
from pydantic import model_validator


class Settings(BaseSettings):
    APP_NAME: str = "Nocturna"
    APP_ENV: str = "dev"
    DATABASE_URL: str = "postgresql://nocturna:nocturna@localhost:5433/nocturna"
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    CORS_ORIGINS: List[str] = [
        "http://localhost:3001",
        "http://localhost:19006",
        "exp://127.0.0.1:19000",
    ]
    DEFAULT_CITY: str = "rome"
    SEED_ON_STARTUP: bool = True
    ADMIN_BOOTSTRAP_EMAIL: str = "admin@nocturna.app"
    ADMIN_BOOTSTRAP_PASSWORD: str = "ChangeMe123!"

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.APP_ENV.lower() not in {"dev", "development", "test"}:
            if self.SECRET_KEY == "change-me-in-production" or len(self.SECRET_KEY) < 32:
                raise ValueError("Production requires a unique SECRET_KEY of at least 32 characters")
            if self.SEED_ON_STARTUP and self.ADMIN_BOOTSTRAP_PASSWORD == "ChangeMe123!":
                raise ValueError("Production seeding requires a unique ADMIN_BOOTSTRAP_PASSWORD")
        return self

    class Config:
        env_file = ".env"
        env_prefix = "NOCTURNA_"


@lru_cache
def get_settings() -> Settings:
    return Settings()
