from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Midas"
    environment: str = "development"
    database_url: str = "sqlite:///./midas.db"
    default_sender_email: str = "founder@midas.local"
    default_sender_name: str = "Midas Team"
    base_url: str = "http://localhost:8000"
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None
    auto_reply_wait_minutes: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
