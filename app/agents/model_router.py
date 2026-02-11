from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Callable

from app.core.config import ModelTarget, settings


@dataclass(slots=True)
class GenerationRequest:
    instruction: str
    temperature: float = 0.6
    reserve_premium: bool = False


class ModelRouter:
    """Rotates provider+key+model and enforces reserve of premium models for reply-critical tasks."""

    def __init__(self, targets: list[ModelTarget] | None = None) -> None:
        self.targets = targets or settings.model_targets
        self.usage = defaultdict(int)

    def ordered_targets(self, reserve_premium: bool) -> list[ModelTarget]:
        if reserve_premium:
            non_premium = [t for t in self.targets if t.tier != "premium"]
            premium = [t for t in self.targets if t.tier == "premium"]
            return non_premium + premium
        return self.targets

    def generate(self, req: GenerationRequest, provider_call: Callable[[ModelTarget, GenerationRequest], str]) -> str:
        last_error: Exception | None = None
        for target in self.ordered_targets(req.reserve_premium):
            try:
                output = provider_call(target, req)
                self.usage[f"{target.provider}:{target.model}"] += 1
                return output
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                continue
        raise RuntimeError(f"All model targets failed. last_error={last_error}")
