from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agents.email_agents import (
    ADKProviderAdapter,
    FollowUpAgent,
    OutreachTemplateAgent,
    ReplyAgent,
    TemplateQualityAgent,
)
from app.agents.model_router import ModelRouter
from app.core.config import settings
from app.models.entities import Alert, EmailMessage, EmailTemplate, EmailType, Lead, LeadStatus, MailboxUsage, ReplyMessage
from app.models.schemas import DashboardMetrics
from app.services.email_gateway import EmailGateway
from app.services.template_engine import render_template


class CampaignService:
    def __init__(self, db: Session) -> None:
        self.db = db
        router = ModelRouter()
        provider = ADKProviderAdapter()
        self.outreach_agent = OutreachTemplateAgent(router, provider)
        self.quality_agent = TemplateQualityAgent(router, provider)
        self.reply_agent = ReplyAgent(router, provider)
        self.followup_agent = FollowUpAgent(router, provider)
        self.email_gateway = EmailGateway()

    def seed_templates(self, objective: str, niche: str | None = None) -> int:
        templates = self.outreach_agent.generate_templates(objective, niche)
        created = 0
        for t in templates:
            score = self.quality_agent.score(t["subject"], t["body"])
            self.db.add(
                EmailTemplate(
                    name=t["name"],
                    email_type=EmailType.outreach,
                    objective=objective,
                    subject_template=t["subject"],
                    body_template=t["body"],
                    quality_score=score,
                )
            )
            created += 1
        self.db.commit()
        return created

    def _mailbox_capacity_ok(self) -> bool:
        day = datetime.utcnow().strftime("%Y-%m-%d")
        usage = self.db.scalar(
            select(MailboxUsage).where(
                MailboxUsage.sender_email == settings.sender_email,
                MailboxUsage.day == day,
            )
        )
        return not usage or usage.count_sent < settings.daily_send_limit_per_mailbox

    def _register_send(self) -> None:
        day = datetime.utcnow().strftime("%Y-%m-%d")
        usage = self.db.scalar(
            select(MailboxUsage).where(
                MailboxUsage.sender_email == settings.sender_email,
                MailboxUsage.day == day,
            )
        )
        if usage is None:
            usage = MailboxUsage(sender_email=settings.sender_email, day=day, count_sent=0)
            self.db.add(usage)
        usage.count_sent += 1

    def send_outreach_batch(self, limit: int = 20) -> int:
        sent = 0
        leads = self.db.scalars(
            select(Lead).where(Lead.status == LeadStatus.new, Lead.opt_out.is_(False)).limit(limit)
        ).all()
        templates = self.db.scalars(
            select(EmailTemplate)
            .where(EmailTemplate.email_type == EmailType.outreach, EmailTemplate.is_active.is_(True))
            .order_by(EmailTemplate.usage_count.asc(), EmailTemplate.quality_score.desc())
        ).all()
        if not templates:
            return 0
        for lead in leads:
            if not self._mailbox_capacity_ok():
                self.db.add(Alert(severity="warning", message="Daily mailbox limit reached"))
                break
            tpl = templates[sent % len(templates)]
            context = {
                "name": lead.name,
                "company": lead.company or "your company",
                "niche": lead.niche or "your market",
                "objective": tpl.objective,
                "sender_name": "Midas Team",
                "unsubscribe_link": f"http://127.0.0.1:8000/unsubscribe/{lead.email}",
            }
            subject = render_template(tpl.subject_template, context)
            body = render_template(tpl.body_template, context)
            message_id = self.email_gateway.send(lead.email, subject, body, settings.sender_email)
            self.db.add(
                EmailMessage(
                    lead_id=lead.id,
                    template_id=tpl.id,
                    email_type=EmailType.outreach,
                    subject=subject,
                    body=body,
                    external_message_id=message_id,
                )
            )
            tpl.usage_count += 1
            lead.status = LeadStatus.outreached
            lead.last_contacted_at = datetime.utcnow()
            self._register_send()
            sent += 1
        self.db.commit()
        return sent

    def create_followups(self, max_followups: int = 20) -> int:
        sent = 0
        leads = self.db.scalars(
            select(Lead).where(Lead.status == LeadStatus.outreached, Lead.opt_out.is_(False)).limit(max_followups)
        ).all()
        for lead in leads:
            if not self._mailbox_capacity_ok():
                break
            last_outreach = self.db.scalar(
                select(EmailMessage)
                .where(EmailMessage.lead_id == lead.id)
                .order_by(EmailMessage.sent_at.desc())
            )
            if not last_outreach:
                continue
            subject_tpl, body_tpl = self.followup_agent.draft(
                last_outreach.subject,
                last_outreach.body,
                objective="pipeline growth",
                touch_no=1,
            )
            context = {
                "name": lead.name,
                "sender_name": "Midas Team",
                "unsubscribe_link": f"http://127.0.0.1:8000/unsubscribe/{lead.email}",
            }
            subject = render_template(subject_tpl, context)
            body = render_template(body_tpl, context)
            message_id = self.email_gateway.send(lead.email, subject, body, settings.sender_email)
            self.db.add(
                EmailMessage(
                    lead_id=lead.id,
                    email_type=EmailType.follow_up,
                    subject=subject,
                    body=body,
                    external_message_id=message_id,
                )
            )
            lead.status = LeadStatus.follow_up_due
            self._register_send()
            sent += 1
        self.db.commit()
        return sent

    def process_incoming_reply(self, lead_email: str, raw_body: str) -> None:
        lead = self.db.scalar(select(Lead).where(Lead.email == lead_email.lower()))
        if not lead:
            self.db.add(Alert(severity="warning", message=f"Reply from unknown sender: {lead_email}"))
            self.db.commit()
            return

        last_email = self.db.scalar(
            select(EmailMessage).where(EmailMessage.lead_id == lead.id).order_by(EmailMessage.sent_at.desc())
        )
        initial_context = last_email.body if last_email else ""
        sentiment, subject, body = self.reply_agent.analyze_and_draft(
            raw_body,
            initial_context,
            objective="pipeline growth",
        )
        self.db.add(
            ReplyMessage(
                lead_id=lead.id,
                raw_body=raw_body,
                sentiment=sentiment,
                suggested_reply_subject=subject,
                suggested_reply_body=body,
            )
        )
        lead.status = LeadStatus.replied
        if sentiment.value == "negative":
            lead.opt_out = True
            lead.status = LeadStatus.opted_out
        self.db.add(
            Alert(
                lead_id=lead.id,
                severity="info",
                message=f"Reply received from {lead.email} ({sentiment.value}). Suggested draft ready.",
            )
        )
        self.db.commit()

    def approve_and_send_suggested_reply(self, lead_id: int) -> bool:
        reply = self.db.scalar(
            select(ReplyMessage)
            .where(ReplyMessage.lead_id == lead_id, ReplyMessage.suggested_reply_sent.is_(False))
            .order_by(ReplyMessage.received_at.desc())
        )
        lead = self.db.get(Lead, lead_id)
        if not reply or not lead:
            return False
        mid = self.email_gateway.send(
            lead.email,
            reply.suggested_reply_subject or "Re: follow up",
            reply.suggested_reply_body or "",
            settings.sender_email,
        )
        self.db.add(
            EmailMessage(
                lead_id=lead_id,
                email_type=EmailType.reply,
                subject=reply.suggested_reply_subject or "Re: follow up",
                body=reply.suggested_reply_body or "",
                external_message_id=mid,
            )
        )
        reply.suggested_reply_sent = True
        self._register_send()
        self.db.commit()
        return True

    def unsubscribe(self, email: str, reason: str | None = None) -> bool:
        lead = self.db.scalar(select(Lead).where(Lead.email == email.lower()))
        if not lead:
            return False
        lead.opt_out = True
        lead.status = LeadStatus.opted_out
        self.db.add(Alert(lead_id=lead.id, severity="info", message=f"Lead unsubscribed. reason={reason or 'n/a'}"))
        self.db.commit()
        return True

    def metrics(self) -> DashboardMetrics:
        total = self.db.scalar(select(func.count()).select_from(Lead)) or 0
        outreached = self.db.scalar(select(func.count()).select_from(Lead).where(Lead.status == LeadStatus.outreached)) or 0
        replied = self.db.scalar(select(func.count()).select_from(Lead).where(Lead.status == LeadStatus.replied)) or 0
        follow_up_due = (
            self.db.scalar(select(func.count()).select_from(Lead).where(Lead.status == LeadStatus.follow_up_due)) or 0
        )
        templates_total = self.db.scalar(select(func.count()).select_from(EmailTemplate)) or 0
        conversion_rate = round((replied / outreached) * 100, 2) if outreached else 0.0
        return DashboardMetrics(
            total_leads=total,
            outreached=outreached,
            replied=replied,
            follow_up_due=follow_up_due,
            conversion_rate=conversion_rate,
            templates_total=templates_total,
        )
