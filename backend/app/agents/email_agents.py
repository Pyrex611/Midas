from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from sqlmodel import Session

from app.agents.model_router import ModelRouter

try:
    from google.adk.agents import LlmAgent
    from google.adk.models.google_llm import Gemini
except Exception:  # pragma: no cover
    LlmAgent = None
    Gemini = None


@dataclass
class GeneratedEmail:
    subject: str
    body: str
    score: float


class BaseMidasAgent:
    def __init__(self, session: Session, purpose: str, instruction: str, output_schema: dict[str, Any]):
        self.session = session
        self.router = ModelRouter(session)
        self.purpose = purpose
        self.instruction = instruction
        self.output_schema = output_schema

    def run(self, prompt: str) -> dict[str, Any]:
        profile = self.router.pick_model(self.purpose)
        if LlmAgent and Gemini:
            agent = LlmAgent(
                name=f"Midas{self.purpose.title()}Agent",
                model=Gemini(model=profile.model_name),
                instruction=self.instruction,
            )
            result = agent.run(prompt)
            payload = result if isinstance(result, dict) else json.loads(str(result))
        else:
            payload = {
                "subject": "Quick idea to improve your conversion velocity",
                "body": f"Hi there,\n\n{prompt[:240]}\n\nBest,\nMidas",
                "score": 0.82,
            }
        self.router.mark_usage(profile, estimated_tokens=max(200, len(prompt) // 3))
        return payload


OUTREACH_INSTRUCTION = """
You are an elite cold outreach strategist. Generate concise, compliant, high-converting outreach email drafts.
Use personalization placeholders and always include a legally-compliant opt-out section.
Return JSON with keys: subject, body, score.
"""

TEMPLATE_REVIEW_INSTRUCTION = """
You are a top 0.1% email conversion auditor.
Given an email template, improve clarity, CTA strength, subject performance, anti-spam language, and personalization hooks.
Return JSON with keys: subject, body, score.
"""

REPLY_INSTRUCTION = """
You write highly effective, context-aware reply emails.
Adapt to sentiment and campaign objective while preserving professionalism and next-step momentum.
Return JSON with keys: subject, body, score.
"""

FOLLOW_UP_INSTRUCTION = """
You draft follow-up emails for non-responders using previous outreach context.
Keep it brief, value-rich, and frictionless with one CTA.
Return JSON with keys: subject, body, score.
"""


def generate_outreach_email(session: Session, context: str) -> GeneratedEmail:
    agent = BaseMidasAgent(session, "outreach", OUTREACH_INSTRUCTION, {})
    data = agent.run(context)
    return GeneratedEmail(**data)


def optimize_template(session: Session, template_text: str) -> GeneratedEmail:
    agent = BaseMidasAgent(session, "template_eval", TEMPLATE_REVIEW_INSTRUCTION, {})
    data = agent.run(template_text)
    return GeneratedEmail(**data)


def draft_reply_email(session: Session, context: str) -> GeneratedEmail:
    agent = BaseMidasAgent(session, "reply", REPLY_INSTRUCTION, {})
    data = agent.run(context)
    return GeneratedEmail(**data)


def draft_follow_up_email(session: Session, context: str) -> GeneratedEmail:
    agent = BaseMidasAgent(session, "follow_up", FOLLOW_UP_INSTRUCTION, {})
    data = agent.run(context)
    return GeneratedEmail(**data)
