from __future__ import annotations

from dataclasses import dataclass
from itertools import cycle


@dataclass
class ModelSlot:
    api_key: str
    model: str


class LLMRouter:
    """Simple round-robin allocator to rotate through keys/models and preserve premium models for reply tasks."""

    def __init__(self, api_keys: list[str], models: list[str]):
        self.general_pool: list[ModelSlot] = [ModelSlot(k, m) for k in api_keys for m in models if "2.5" not in m or "flash" in m]
        self.premium_pool: list[ModelSlot] = [ModelSlot(k, m) for k in api_keys for m in models if "2.5" in m]
        self.general_iter = cycle(self.general_pool or [ModelSlot("", models[0] if models else "gemini-2.5-flash-lite")])
        self.premium_iter = cycle(self.premium_pool or self.general_pool or [ModelSlot("", "gemini-2.5-flash")])

    def next_slot(self, critical: bool = False) -> ModelSlot:
        return next(self.premium_iter if critical else self.general_iter)
