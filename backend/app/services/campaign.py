from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.agents.email_agents import OutreachTemplateAgent, TemplateQualityAgent, ReplyAgent, FollowupAgent
from app.agents.llm_router import LLMRouter
from app.core.config import settings
from app.models.entities import Lead, LeadStatus, Template, TemplateType, Conversation, EmailDirection, Alert, MailboxUsage, OptOut
from app.schemas.types import CampaignConfig, ReplyPolicy


class CampaignService:
    def __init__(self, db: Session):
        self.db = db
        router = LLMRouter(settings.api_keys, settings.models)
        self.outreach_agent = OutreachTemplateAgent(router)
        self.quality_agent = TemplateQualityAgent(router)
        self.reply_agent = ReplyAgent(router)
        self.followup_agent = FollowupAgent(router)

    def add_leads(self, leads: list[dict]) -> dict:
        inserted = 0
        duplicates = 0
        for payload in leads:
            if self.db.query(Lead).filter(Lead.email == payload["email"]).first() or self.db.query(OptOut).filter(OptOut.lead_email == payload["email"]).first():
                duplicates += 1
                continue
            self.db.add(Lead(**payload))
            inserted += 1
        self.db.commit()
        return {"inserted": inserted, "duplicates": duplicates}

    def _increment_mailbox_usage(self, mailbox_email: str):
        date_key = datetime.utcnow().strftime("%Y-%m-%d")
        row = self.db.query(MailboxUsage).filter(MailboxUsage.mailbox_email == mailbox_email, MailboxUsage.date_key == date_key).first()
        if not row:
            row = MailboxUsage(mailbox_email=mailbox_email, date_key=date_key, sent_count=0)
            self.db.add(row)
        row.sent_count += 1
        self.db.flush()
        if row.sent_count > settings.daily_send_limit_per_mailbox:
            self.db.add(Alert(level="warning", message=f"Mailbox {mailbox_email} exceeded daily limit"))

    def generate_template_bank(self, config: CampaignConfig, count: int = 8, template_type: TemplateType = TemplateType.outreach):
        for i in range(count):
            context = {
                "objective": config.objective,
                "tone": config.tone,
                "company": "prospect company",
                "niche": "general",
            }
            if template_type == TemplateType.followup:
                draft = self.followup_agent.generate_followup("Initial outreach placeholder", "there", config.objective)
            else:
                draft = self.outreach_agent.generate(context)
            scored = self.quality_agent.review(draft)
            template = Template(
                name=f"{template_type.value.title()} Template {i+1}",
                template_type=template_type,
                subject=scored.subject,
                body=scored.body,
                score=scored.score,
                tags=f"objective:{config.objective}",
            )
            self.db.add(template)
        self.db.commit()

    def _render(self, template: Template, lead: Lead, config: CampaignConfig) -> tuple[str, str]:
        replacements = {
            "{{name}}": lead.name,
            "{{company}}": lead.company or "your company",
            "{{position}}": lead.position or "your role",
            "{{objective}}": lead.objective or config.objective,
            "{{unsubscribe_link}}": f"https://midas.local/opt-out?email={lead.email}",
        }
        body = template.body
        for k, v in replacements.items():
            body = body.replace(k, v)
        return template.subject.replace("{{company}}", replacements["{{company}}"]), body

    def run_outreach(self, config: CampaignConfig, limit: int = 50):
        templates = self.db.query(Template).filter(Template.template_type == TemplateType.outreach).order_by(Template.score.desc(), Template.usage_count.asc()).all()
        if not templates:
            self.generate_template_bank(config, count=6, template_type=TemplateType.outreach)
            templates = self.db.query(Template).filter(Template.template_type == TemplateType.outreach).order_by(Template.score.desc()).all()

        leads = self.db.query(Lead).filter(Lead.status == LeadStatus.new, Lead.opted_out.is_(False)).limit(limit).all()
        for idx, lead in enumerate(leads):
            template = templates[idx % len(templates)]
            subject, body = self._render(template, lead, config)
            self.db.add(Conversation(lead_id=lead.id, direction=EmailDirection.outbound, subject=subject, body=body, category="outreach"))
            lead.status = LeadStatus.contacted
            template.usage_count += 1
            self._increment_mailbox_usage(settings.default_sender_email)
        self.db.commit()
        return {"sent": len(leads)}

    def process_inbound_reply(self, lead_email: str, subject: str, body: str, reply_policy: ReplyPolicy, config: CampaignConfig):
        lead = self.db.query(Lead).filter(Lead.email == lead_email).first()
        if not lead:
            return {"ok": False, "reason": "unknown lead"}

        sentiment = self.classify_sentiment(body)
        self.db.add(Conversation(lead_id=lead.id, direction=EmailDirection.inbound, subject=subject, body=body, sentiment=sentiment, category="reply", auto_generated=False))
        lead.status = LeadStatus.replied
        policy = getattr(reply_policy, sentiment, reply_policy.neutral)
        drafted = self.reply_agent.generate_reply(body, policy, lead.name)
        self.db.add(Alert(lead_id=lead.id, level="info", message=f"Lead replied ({sentiment}). Drafted response ready."))

        if config.auto_reply_enabled:
            self.db.add(Conversation(lead_id=lead.id, direction=EmailDirection.outbound, subject=drafted.subject, body=drafted.body, category="reply"))
            self._increment_mailbox_usage(settings.default_sender_email)
        self.db.commit()
        return {"ok": True, "sentiment": sentiment, "draft_reply": drafted.body}

    def classify_sentiment(self, text: str) -> str:
        lowered = text.lower()
        if any(x in lowered for x in ["interested", "yes", "let's talk", "book"]):
            return "positive"
        if any(x in lowered for x in ["not interested", "stop", "unsubscribe"]):
            return "negative"
        return "neutral"

    def run_followups(self, config: CampaignConfig):
        targets = self.db.query(Lead).filter(Lead.status == LeadStatus.contacted, Lead.opted_out.is_(False)).all()
        count = 0
        for lead in targets:
            first = self.db.query(Conversation).filter(Conversation.lead_id == lead.id, Conversation.category == "outreach").order_by(Conversation.created_at.asc()).first()
            if not first:
                continue
            draft = self.followup_agent.generate_followup(first.body, lead.name, config.objective)
            draft = self.quality_agent.review(draft)
            self.db.add(Conversation(lead_id=lead.id, direction=EmailDirection.outbound, subject=draft.subject, body=draft.body, category="followup"))
            lead.status = LeadStatus.followup_sent
            self._increment_mailbox_usage(settings.default_sender_email)
            count += 1
        self.db.commit()
        return {"followups_sent": count}

    def apply_opt_out(self, email: str, reason: str | None):
        lead = self.db.query(Lead).filter(Lead.email == email).first()
        if lead:
            lead.opted_out = True
            lead.status = LeadStatus.opted_out
        if not self.db.query(OptOut).filter(OptOut.lead_email == email).first():
            self.db.add(OptOut(lead_email=email, reason=reason))
        self.db.commit()
        return {"ok": True}
