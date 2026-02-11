from __future__ import annotations

import random
from dataclasses import dataclass

from app.agents.model_router import GenerationRequest, ModelRouter
from app.models.entities import Sentiment


@dataclass(slots=True)
class AgentContext:
    objective: str
    sender_name: str


class ADKProviderAdapter:
    """Adapter seam for google-adk Gemini calls; currently deterministic local generation for MVP safety."""

    def call(self, target, req: GenerationRequest) -> str:  # noqa: ANN001
        if "fail" in target.api_key:
            raise RuntimeError("Simulated rate-limit/invalid-key")
        return f"[{target.model}] {req.instruction[:120]}"


class OutreachTemplateAgent:
    def __init__(self, router: ModelRouter, provider: ADKProviderAdapter) -> None:
        self.router = router
        self.provider = provider

    def generate_templates(self, objective: str, niche: str | None, count: int = 6) -> list[dict[str, str]]:
        templates: list[dict[str, str]] = []
        for idx in range(count):
            prompt = (
                f"Generate high-converting outreach email template #{idx + 1} for objective={objective}, "
                f"niche={niche or 'general'}, include concise CTA and compliance footer."
            )
            _ = self.router.generate(GenerationRequest(prompt, temperature=0.8), self.provider.call)
            templates.append(
                {
                    "name": f"Outreach Variant {idx + 1}",
                    "subject": random.choice(
                        [
                            "Quick idea for {{company}}'s {{niche}} growth",
                            "{{name}}, a low-lift way to improve {{objective}}",
                            "Could this unlock 15% more pipeline at {{company}}?",
                        ]
                    ),
                    "body": (
                        "Hi {{name}},\n\n"
                        "I noticed {{company}} is active in {{niche}} and thought this may help with {{objective}}. "
                        "We've helped similar teams reduce friction and improve conversion with a light-touch rollout.\n\n"
                        "Would you be open to a 15-minute call this week?\n\n"
                        "Best,\n{{sender_name}}\n\n"
                        "---\n"
                        "If you'd prefer not to receive future emails, unsubscribe: {{unsubscribe_link}}"
                    ),
                }
            )
        return templates


class TemplateQualityAgent:
    def __init__(self, router: ModelRouter, provider: ADKProviderAdapter) -> None:
        self.router = router
        self.provider = provider

    def score(self, subject: str, body: str) -> float:
        prompt = f"Score this cold email 0-100 for conversion and compliance. subject={subject}"
        _ = self.router.generate(GenerationRequest(prompt, temperature=0.2), self.provider.call)
        score = 72.0
        if "15-minute" in body:
            score += 8
        if "unsubscribe" in body.lower():
            score += 8
        if "{{name}}" in body:
            score += 4
        return min(score, 99.0)


class ReplyAgent:
    def __init__(self, router: ModelRouter, provider: ADKProviderAdapter) -> None:
        self.router = router
        self.provider = provider

    def analyze_and_draft(self, raw_reply: str, initial_email: str, objective: str) -> tuple[Sentiment, str, str]:
        lowered = raw_reply.lower()
        sentiment = Sentiment.neutral
        if any(tok in lowered for tok in ["stop", "unsubscribe", "not interested", "remove"]):
            sentiment = Sentiment.negative
        elif any(tok in lowered for tok in ["yes", "interested", "let's", "schedule"]):
            sentiment = Sentiment.positive

        prompt = (
            "Draft a concise top-tier sales follow-up reply based on lead sentiment and prior context."
            f" sentiment={sentiment.value} objective={objective}"
        )
        _ = self.router.generate(
            GenerationRequest(prompt, reserve_premium=True, temperature=0.4),
            self.provider.call,
        )

        if sentiment == Sentiment.positive:
            subject = "Great to connect — quick scheduling options"
            body = (
                "Thanks for the quick response — appreciate your interest.\n\n"
                "I can tailor the discussion to your current priorities and share a practical 30-day execution plan. "
                "Would Tuesday 11:00 or Wednesday 14:00 work for a brief call?"
            )
        elif sentiment == Sentiment.negative:
            subject = "Acknowledged — we’ll close this loop"
            body = (
                "Thanks for letting me know. I’ve removed you from outreach and won’t follow up further. "
                "If priorities change, I’d be happy to reconnect in the future."
            )
        else:
            subject = "Re: quick follow-up"
            body = (
                "Thanks for your response. If helpful, I can send a short one-page breakdown tailored to your context "
                "so you can evaluate fit asynchronously before we schedule time."
            )
        return sentiment, subject, body


class FollowUpAgent:
    def __init__(self, router: ModelRouter, provider: ADKProviderAdapter) -> None:
        self.router = router
        self.provider = provider

    def draft(self, initial_subject: str, initial_body: str, objective: str, touch_no: int) -> tuple[str, str]:
        prompt = (
            f"Generate follow-up email touch={touch_no} using previous subject={initial_subject}, objective={objective},"
            " keep concise and high-converting."
        )
        _ = self.router.generate(GenerationRequest(prompt, temperature=0.5), self.provider.call)
        subject = f"Following up on {objective.lower()}"
        body = (
            "Hi {{name}},\n\n"
            "Wanted to bump this in case it got buried. Based on your current priorities, "
            "I can share a focused plan with expected outcomes and rollout effort.\n\n"
            "Open to a short call this week?\n\n"
            "Best,\n{{sender_name}}\n\n"
            "---\nUnsubscribe: {{unsubscribe_link}}"
        )
        return subject, body
