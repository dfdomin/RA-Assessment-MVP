from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_ENV: str = "development"

    DATABASE_URL: str = "postgresql+asyncpg://ra_user:ra_pass@localhost/ra_assessment"
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    ALLOWED_ORIGINS: list[str] = ["http://localhost:8000"]

    # Optional Microsoft OIDC (F12)
    MICROSOFT_CLIENT_ID: str | None = None
    MICROSOFT_CLIENT_SECRET: str | None = None
    MICROSOFT_TENANT_ID: str | None = None

    GMAIL_APP_PASSWORD: str | None = None
    BACKUP_GPG_RECIPIENT: str | None = None


settings = Settings()
