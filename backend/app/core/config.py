from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


# Resolve env files independent of the process working directory.
# Common dev flows run uvicorn from repo root or from backend/, so we
# explicitly look for backend/.env first and then fall back to repo/.env.
_BACKEND_DIR = Path(__file__).resolve().parents[2]  # .../backend
_REPO_DIR = _BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(_BACKEND_DIR / ".env"), str(_REPO_DIR / ".env")),
        env_file_encoding="utf-8",
    )

    app_name: str = "Beach Tennis SaaS"
    environment: str = "dev"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 30
    refresh_token_expire_minutes: int = 60 * 24 * 7
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/app_beach"


settings = Settings()

