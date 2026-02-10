from datetime import datetime, timedelta

from sqlmodel import Session, SQLModel, create_engine

from app.models.entities import EmailTemplate, Lead, LeadStage, TemplateType
from app.services.outreach_service import OutreachService


def test_follow_up_cycle_includes_follow_up_due_stage():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        session.add(
            EmailTemplate(
                name="fu",
                template_type=TemplateType.follow_up,
                subject="Checking in {name}",
                body="Hi {name}, just following up.",
                score=1.0,
            )
        )
        session.add(
            Lead(
                name="Taylor",
                email="taylor@example.com",
                stage=LeadStage.follow_up_due,
                updated_at=datetime.utcnow() - timedelta(hours=96),
            )
        )
        session.commit()

        sent = OutreachService(session).run_follow_up_cycle(hours_since_last_touch=72)

        assert sent == 1
