from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    app_name: str = "Midas"
    env: str = "dev"
    debug: bool = True
    database_url: str = "sqlite:///./midas.db"
    default_sender_email: str = "outreach@midas.local"
    webhook_alerts_enabled: bool = False
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None
    auto_reply_wait_minutes: int = 60
    daily_send_limit_per_mailbox: int = 150
    google_api_keys: str = Field(default="", description="Comma-separated Gemini keys")
    google_models: str = Field(default="gemini-2.5-flash,gemini-2.5-flash-lite")

    model_config = SettingsConfigDict(env_file=".env", env_prefix="MIDAS_")

    @property
    def api_keys(self) -> list[str]:
        return [k.strip() for k in self.google_api_keys.split(",") if k.strip()]

    @property
    def models(self) -> list[str]:
        return [m.strip() for m in self.google_models.split(",") if m.strip()]


settings = Settings()
