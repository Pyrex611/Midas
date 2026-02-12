from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class ModelTarget:
    provider: str
    model: str
    api_key: str
    priority: int
    tier: str = "standard"


@dataclass(slots=True)
class Settings:
    db_url: str = os.getenv("MIDAS_DB_URL", "sqlite:///./midas.db")
    sender_email: str = os.getenv("MIDAS_SENDER_EMAIL", "hello@midas.local")
    daily_send_limit_per_mailbox: int = int(
        os.getenv("MIDAS_DAILY_SEND_LIMIT_PER_MAILBOX", "80")
    )
    reply_auto_send_delay_minutes: int = int(
        os.getenv("MIDAS_REPLY_AUTO_SEND_DELAY_MINUTES", "60")
    )
    cors_allowed_origins: list[str] = field(
        default_factory=lambda: [
            origin.strip()
            for origin in os.getenv("MIDAS_CORS_ALLOWED_ORIGINS", "*").split(",")
            if origin.strip()
        ]
    )
    model_config_raw: str = os.getenv(
        "MIDAS_MODEL_CONFIG",
        json.dumps(
            [
                {
                    "provider": "google-adk",
                    "model": "gemini-2.5-flash",
                    "api_key": "demo-key-1",
                    "priority": 1,
                    "tier": "premium",
                },
                {
                    "provider": "google-adk",
                    "model": "gemini-2.5-flash-lite",
                    "api_key": "demo-key-2",
                    "priority": 2,
                    "tier": "standard",
                },
            ]
        ),
    )
    model_targets: list[ModelTarget] = field(default_factory=list)

    def __post_init__(self) -> None:
        parsed: list[dict[str, Any]] = json.loads(self.model_config_raw)
        self.model_targets = [ModelTarget(**item) for item in sorted(parsed, key=lambda x: x["priority"])]


settings = Settings()
