from __future__ import annotations

from sqlmodel import Session, select
from app.agents.email_agents import generate_outreach_email, optimize_template, draft_follow_up_email
from app.models.entities import EmailTemplate, TemplateType
from app.schemas.dto import TemplateGenerationRequest


class TemplateService:
    def __init__(self, session: Session):
        self.session = session

    def generate_outreach_bank(self, payload: TemplateGenerationRequest) -> list[EmailTemplate]:
        generated: list[EmailTemplate] = []
        for idx in range(payload.count):
            prompt = (
                f"Objective: {payload.objective}; Niche: {payload.niche}; Tone: {payload.tone}; "
                f"Variant #{idx + 1}. Include {{name}}, {{company}}, {{position}} placeholders."
            )
            draft = generate_outreach_email(self.session, prompt)
            reviewed = optimize_template(self.session, f"Subject:{draft.subject}\nBody:{draft.body}")
            template = EmailTemplate(
                name=f"{payload.niche}-outreach-{idx + 1}",
                template_type=TemplateType.outreach,
                subject=reviewed.subject,
                body=reviewed.body,
                score=reviewed.score,
                tags=f"objective:{payload.objective},niche:{payload.niche}",
            )
            self.session.add(template)
            generated.append(template)

        if payload.include_research_variant:
            draft = generate_outreach_email(
                self.session,
                "Generate research-heavy outreach variant with company-specific discovery and insight hook.",
            )
            template = EmailTemplate(
                name=f"{payload.niche}-research-variant",
                template_type=TemplateType.outreach,
                subject=draft.subject,
                body=draft.body,
                score=draft.score,
                tags="research_variant",
            )
            self.session.add(template)
            generated.append(template)
        self.session.commit()
        for template in generated:
            self.session.refresh(template)
        return generated

    def generate_follow_up_bank(self, objective: str, niche: str, count: int = 4) -> list[EmailTemplate]:
        generated = []
        for i in range(count):
            draft = draft_follow_up_email(
                self.session,
                f"Objective:{objective};Niche:{niche};Variant:{i + 1}; Must include opt-out line.",
            )
            template = EmailTemplate(
                name=f"{niche}-follow-up-{i+1}",
                template_type=TemplateType.follow_up,
                subject=draft.subject,
                body=draft.body,
                score=draft.score,
                tags=f"objective:{objective},niche:{niche}",
            )
            self.session.add(template)
            generated.append(template)
        self.session.commit()
        return generated

    def pick_best_template(self, template_type: TemplateType) -> EmailTemplate | None:
        return self.session.exec(
            select(EmailTemplate)
            .where(EmailTemplate.template_type == template_type)
            .order_by(EmailTemplate.score.desc())
        ).first()
