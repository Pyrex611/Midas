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
        if not self.general_pool:
            self.general_pool = [ModelSlot(k, m) for k in api_keys for m in models]

        self.premium_pool: list[ModelSlot] = [ModelSlot(k, m) for k in api_keys for m in models if "2.5" in m]
        default_key = api_keys[0] if api_keys else ""
        default_general_model = models[0] if models else "gemini-2.5-flash-lite"
        self.general_iter = cycle(self.general_pool or [ModelSlot(default_key, default_general_model)])
        self.premium_iter = cycle(self.premium_pool or self.general_pool or [ModelSlot(default_key, "gemini-2.5-flash")])

    def next_slot(self, critical: bool = False) -> ModelSlot:
        return next(self.premium_iter if critical else self.general_iter)
