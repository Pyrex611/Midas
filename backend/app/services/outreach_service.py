from __future__ import annotations

from datetime import datetime, timedelta
from uuid import uuid4

from sqlmodel import Session, select

from app.agents.email_agents import draft_reply_email, draft_follow_up_email
from app.core.config import get_settings
from app.models.entities import Alert, EmailMessage, Lead, LeadStage, Sentiment, TemplateType
from app.services.template_service import TemplateService


class OutreachService:
    def __init__(self, session: Session):
        self.session = session
        self.settings = get_settings()
        self.template_service = TemplateService(session)

    def _render(self, template: str, lead: Lead) -> str:
        return (
            template.replace("{name}", lead.name)
            .replace("{company}", lead.company or "your company")
            .replace("{position}", lead.position or "your team")
            .replace("{unsubscribe_link}", f"{self.settings.base_url}/opt-out/{lead.id}")
        )

    def send_outreach_batch(self, limit: int = 50) -> int:
        template = self.template_service.pick_best_template(TemplateType.outreach)
        if not template:
            return 0
        leads = self.session.exec(
            select(Lead).where(Lead.stage == LeadStage.new, Lead.opted_out.is_(False)).limit(limit)
        ).all()
        sent = 0
        for lead in leads:
            msg = EmailMessage(
                lead_id=lead.id,
                template_id=template.id,
                direction="outbound",
                kind="outreach",
                subject=self._render(template.subject, lead),
                body=self._render(template.body, lead),
                sender_email=self.settings.default_sender_email,
                recipient_email=lead.email,
                message_id=str(uuid4()),
            )
            lead.stage = LeadStage.contacted
            lead.updated_at = datetime.utcnow()
            self.session.add(msg)
            self.session.add(lead)
            sent += 1
        self.session.commit()
        return sent

    def classify_sentiment(self, text: str) -> Sentiment:
        lower = text.lower()
        if any(k in lower for k in ["interested", "yes", "let's chat", "book"]):
            return Sentiment.positive
        if any(k in lower for k in ["stop", "unsubscribe", "not interested"]):
            return Sentiment.negative
        return Sentiment.neutral

    def register_inbound(self, lead: Lead, subject: str, body: str) -> EmailMessage:
        sentiment = self.classify_sentiment(f"{subject} {body}")
        message = EmailMessage(
            lead_id=lead.id,
            direction="inbound",
            kind="reply",
            subject=subject,
            body=body,
            sender_email=lead.email,
            recipient_email=self.settings.default_sender_email,
            sentiment=sentiment,
            message_id=str(uuid4()),
        )
        lead.stage = LeadStage.replied
        lead.updated_at = datetime.utcnow()
        self.session.add(message)
        self.session.add(lead)
        self.session.add(
            Alert(
                severity="high" if sentiment == Sentiment.positive else "info",
                message=f"New {sentiment.value} reply from {lead.name}",
                lead_id=lead.id,
            )
        )
        self.session.commit()
        self.session.refresh(message)
        return message

    def prepare_reply_draft(self, lead: Lead, inbound: EmailMessage) -> EmailMessage:
        prompt = (
            f"Campaign objective: {lead.objective or 'business development'};\n"
            f"Lead: {lead.name}, {lead.position or ''} at {lead.company or ''};\n"
            f"Inbound sentiment: {inbound.sentiment};\n"
            f"Inbound message:\n{inbound.body}"
        )
        drafted = draft_reply_email(self.session, prompt)
        message = EmailMessage(
            lead_id=lead.id,
            direction="outbound",
            kind="reply",
            subject=drafted.subject,
            body=self._render(drafted.body, lead),
            sender_email=self.settings.default_sender_email,
            recipient_email=lead.email,
            message_id=str(uuid4()),
        )
        self.session.add(message)
        self.session.commit()
        return message

    def run_follow_up_cycle(self, hours_since_last_touch: int = 72) -> int:
        template = self.template_service.pick_best_template(TemplateType.follow_up)
        if not template:
            return 0
        threshold = datetime.utcnow() - timedelta(hours=hours_since_last_touch)
        leads = self.session.exec(
            select(Lead)
            .where(
                Lead.stage.in_([LeadStage.contacted, LeadStage.follow_up_due]),
                Lead.opted_out.is_(False),
                Lead.updated_at < threshold,
            )
            .limit(100)
        ).all()
        sent = 0
        for lead in leads:
            body = self._render(template.body, lead)
            if lead.company and lead.position:
                dynamic = draft_follow_up_email(
                    self.session,
                    f"Lead={lead.name};Company={lead.company};Position={lead.position};"
                    f"Objective={lead.objective or 'partnership'};"
                    "Make it personalized and concise."
                )
                body = self._render(dynamic.body, lead)
            msg = EmailMessage(
                lead_id=lead.id,
                template_id=template.id,
                direction="outbound",
                kind="follow_up",
                subject=self._render(template.subject, lead),
                body=body,
                sender_email=self.settings.default_sender_email,
                recipient_email=lead.email,
                message_id=str(uuid4()),
            )
            lead.stage = LeadStage.follow_up_due
            lead.updated_at = datetime.utcnow()
            self.session.add(msg)
            self.session.add(lead)
            sent += 1
        self.session.commit()
        return sent
