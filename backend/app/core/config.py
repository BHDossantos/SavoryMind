from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "SavoryMind API"
    database_url: str = "sqlite:///./savorymind.db"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    secret_key: str = "savorymind-super-secret-change-in-production-32chars"
    algorithm: str = "HS256"
    access_token_expire_days: int = 30

    class Config:
        env_file = ".env"


settings = Settings()
