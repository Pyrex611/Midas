from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable
from sqlmodel import Session, select
from app.models.entities import ApiUsage


@dataclass
class ModelProfile:
    model_name: str
    api_key_alias: str
    daily_limit: int


DEFAULT_MODELS = [
    ModelProfile("gemini-2.5-flash-lite", "primary", 250),
    ModelProfile("gemini-2.0-flash", "secondary", 400),
    ModelProfile("gemini-1.5-flash", "tertiary", 600),
]


class ModelRouter:
    """Simple allocator that preserves premium quota for reply drafting tasks."""

    def __init__(self, session: Session, reserve_for_replies: int = 60):
        self.session = session
        self.reserve_for_replies = reserve_for_replies

    def _get_or_create_usage(self, profile: ModelProfile) -> ApiUsage:
        usage = self.session.exec(
            select(ApiUsage).where(
                ApiUsage.model_name == profile.model_name,
                ApiUsage.api_key_alias == profile.api_key_alias,
            )
        ).first()
        if usage:
            return usage
        usage = ApiUsage(
            model_name=profile.model_name,
            api_key_alias=profile.api_key_alias,
            daily_limit=profile.daily_limit,
        )
        self.session.add(usage)
        self.session.commit()
        self.session.refresh(usage)
        return usage

    def pick_model(self, purpose: str) -> ModelProfile:
        candidates: Iterable[ModelProfile] = DEFAULT_MODELS
        if purpose == "reply":
            candidates = DEFAULT_MODELS
        elif purpose in {"outreach", "follow_up", "template_eval"}:
            candidates = DEFAULT_MODELS[1:] + DEFAULT_MODELS[:1]

        for profile in candidates:
            usage = self._get_or_create_usage(profile)
            remaining = usage.daily_limit - usage.requests_made
            if purpose != "reply" and profile.model_name.startswith("gemini-2.5"):
                if remaining <= self.reserve_for_replies:
                    continue
            if remaining > 0:
                return profile
        return DEFAULT_MODELS[-1]

    def mark_usage(self, profile: ModelProfile, estimated_tokens: int) -> None:
        usage = self._get_or_create_usage(profile)
        usage.requests_made += 1
        usage.tokens_estimate += estimated_tokens
        usage.last_used_at = datetime.utcnow()
        self.session.add(usage)
        self.session.commit()
