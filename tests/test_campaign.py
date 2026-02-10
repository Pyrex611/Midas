from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.services.campaign_service import CampaignService
from app.services.lead_importer import LeadImporter


def _db():
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)()


def test_import_and_outreach_flow():
    db = _db()
    importer = LeadImporter(db)
    result = importer.import_rows(
        [
            {"name": "Alice", "email": "alice@acme.com", "company": "Acme"},
            {"name": "Bob", "email": "bob@acme.com", "company": "Acme"},
        ]
    )
    assert result.inserted == 2

    service = CampaignService(db)
    created = service.seed_templates("get demos", "SaaS")
    assert created >= 1

    sent = service.send_outreach_batch(limit=10)
    assert sent == 2

    service.process_incoming_reply("alice@acme.com", "Yes, interested. can we schedule?")
    metrics = service.metrics()
    assert metrics.replied == 1


def test_unsubscribe():
    db = _db()
    importer = LeadImporter(db)
    importer.import_rows([{"name": "Eve", "email": "eve@org.com"}])
    service = CampaignService(db)
    ok = service.unsubscribe("eve@org.com", "Not relevant")
    assert ok is True
