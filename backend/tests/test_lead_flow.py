from sqlmodel import Session, SQLModel, create_engine, select

from app.models.entities import Lead
from app.schemas.dto import LeadIn
from app.services.lead_service import LeadService


def test_lead_dedupe_insert():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        svc = LeadService(session)
        payload = [LeadIn(name="A", email="a@test.com"), LeadIn(name="A2", email="a@test.com")]
        result = svc.upsert_leads(payload)
        assert result["inserted"] == 1
        assert result["skipped_existing"] == 1
        leads = session.exec(select(Lead)).all()
        assert len(leads) == 1
