from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.agents.llm_router import LLMRouter

try:
    from google.adk.agents import LlmAgent
    from google.adk.models.google_llm import Gemini
except Exception:  # graceful fallback for local MVP
    LlmAgent = None
    Gemini = None


@dataclass
class Draft:
    subject: str
    body: str
    score: float


class BaseMidasAgent:
    def __init__(self, router: LLMRouter):
        self.router = router

    def _call_llm(self, instruction: str, prompt: str, critical: bool = False) -> str:
        slot = self.router.next_slot(critical=critical)
        if LlmAgent and Gemini and slot.api_key:
            agent = LlmAgent(
                name="MidasAgent",
                model=Gemini(model=slot.model, api_key=slot.api_key),
                instruction=instruction,
            )
            response = agent.run(prompt)
            return str(response)
        return f"{prompt}\n\n-- Optimized with model: {slot.model}"


class OutreachTemplateAgent(BaseMidasAgent):
    instruction = (
        "You generate elite, compliant cold outreach templates with strong subject lines,"
        " concise value proposition, personalization slots, CTA, and opt-out footer."
    )

    def generate(self, context: dict[str, Any]) -> Draft:
        prompt = (
            f"Create outreach email for objective={context['objective']}, niche={context.get('niche')},"
            f" tone={context.get('tone','professional')}."
        )
        body = self._call_llm(" ".join(self.instruction), prompt)
        subject = f"Quick idea for {context.get('company', 'your team')}"
        return Draft(subject=subject, body=body, score=0.85)


class TemplateQualityAgent(BaseMidasAgent):
    def review(self, draft: Draft) -> Draft:
        bonus = 0.1 if "opt-out" in draft.body.lower() else 0.03
        draft.score = min(0.99, draft.score + bonus)
        if "unsubscribe" not in draft.body.lower() and "opt-out" not in draft.body.lower():
            draft.body += "\n\n---\nPrefer not to hear from me? Click here to unsubscribe: {{unsubscribe_link}}"
        return draft


class ReplyAgent(BaseMidasAgent):
    def generate_reply(self, inbound_text: str, policy: str, lead_name: str) -> Draft:
        prompt = (
            f"Draft a conversion-focused reply for {lead_name}."
            f" Policy={policy}. Inbound={inbound_text[:1500]}"
        )
        body = self._call_llm("Generate concise, professional, personalized reply.", prompt, critical=True)
        return Draft(subject=f"Re: Thanks {lead_name}", body=body, score=0.92)


class FollowupAgent(BaseMidasAgent):
    def generate_followup(self, initial_email: str, lead_name: str, objective: str) -> Draft:
        prompt = (
            "Write a non-pushy follow-up email referencing the original outreach."
            f" Lead={lead_name}, objective={objective}, initial={initial_email[:1200]}"
        )
        body = self._call_llm("Create top-tier follow-up template.", prompt)
        return Draft(subject=f"Following up, {lead_name}", body=body, score=0.88)
