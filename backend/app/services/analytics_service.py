from __future__ import annotations

from sqlmodel import Session, func, select
from app.models.entities import EmailMessage, EmailTemplate, Lead, LeadStage
from app.schemas.dto import StatsOut


class AnalyticsService:
    def __init__(self, session: Session):
        self.session = session

    def dashboard_stats(self) -> StatsOut:
        leads_total = self.session.exec(select(func.count(Lead.id))).one()
        contacted = self.session.exec(select(func.count(Lead.id)).where(Lead.stage != LeadStage.new)).one()
        replied = self.session.exec(select(func.count(Lead.id)).where(Lead.stage == LeadStage.replied)).one()
        converted = self.session.exec(select(func.count(Lead.id)).where(Lead.stage == LeadStage.converted)).one()
        opted_out = self.session.exec(select(func.count(Lead.id)).where(Lead.opted_out.is_(True))).one()
        templates = self.session.exec(select(func.count(EmailTemplate.id))).one()
        follow_ups = self.session.exec(select(func.count(EmailMessage.id)).where(EmailMessage.kind == "follow_up")).one()
        response_rate = (replied / contacted) if contacted else 0.0
        opt_out_rate = (opted_out / contacted) if contacted else 0.0
        return StatsOut(
            leads_total=leads_total,
            leads_contacted=contacted,
            leads_replied=replied,
            leads_converted=converted,
            opt_out_rate=round(opt_out_rate * 100, 2),
            response_rate=round(response_rate * 100, 2),
            templates_count=templates,
            follow_ups_sent=follow_ups,
        )
