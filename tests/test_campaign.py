from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from openpyxl import Workbook

from app.core.config import settings
from app.models.entities import Lead, LeadStatus
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
    assert result.invalid_rows == 0

    service = CampaignService(db)
    created = service.seed_templates("get demos", "SaaS")
    assert created >= 1

    sent = service.send_outreach_batch(limit=10)
    assert sent == 2

    service.process_incoming_reply("alice@acme.com", "Yes, interested. can we schedule?")
    metrics = service.metrics()
    assert metrics.replied == 1


def test_xlsx_import_and_invalid_rows_are_tracked():
    db = _db()
    importer = LeadImporter(db)

    wb = Workbook()
    ws = wb.active
    ws.append(["full_name", "email_address", "company_name", "job_title"])
    ws.append(["Dana", "dana@org.com", "Org", "Founder"])
    ws.append(["", "", "", ""])  # invalid

    from io import BytesIO

    stream = BytesIO()
    wb.save(stream)
    rows = importer.parse("leads.xlsx", stream.getvalue())
    result = importer.import_rows(rows)

    assert result.inserted == 1
    assert result.invalid_rows == 0

    dup_result = importer.import_rows([
        {"name": "Dana", "email": "dana@org.com"},
        {"name": "", "email": "missing@org.com"},
    ])
    assert dup_result.skipped_existing == 1
    assert dup_result.invalid_rows == 1

def test_unsubscribe():
    db = _db()
    importer = LeadImporter(db)
    importer.import_rows([{"name": "Eve", "email": "eve@org.com"}])
    service = CampaignService(db)
    ok = service.unsubscribe("eve@org.com", "Not relevant")
    assert ok is True


def test_negative_reply_marks_lead_opted_out():
    db = _db()
    importer = LeadImporter(db)
    importer.import_rows([{"name": "Nora", "email": "nora@org.com"}])

    service = CampaignService(db)
    service.seed_templates("book calls", "SaaS")
    service.send_outreach_batch(limit=1)

    service.process_incoming_reply("nora@org.com", "Thanks, but I am not interested. Please remove me.")

    lead = db.query(Lead).filter(Lead.email == "nora@org.com").one()
    assert lead.opt_out is True
    assert lead.status == LeadStatus.opted_out


def test_send_batch_respects_daily_mailbox_limit_on_first_usage_day():
    db = _db()
    importer = LeadImporter(db)
    importer.import_rows(
        [
            {"name": "A", "email": "a@org.com", "company": "Org"},
            {"name": "B", "email": "b@org.com", "company": "Org"},
            {"name": "C", "email": "c@org.com", "company": "Org"},
        ]
    )
    service = CampaignService(db)
    service.seed_templates("book calls", "SaaS")

    original_limit = settings.daily_send_limit_per_mailbox
    settings.daily_send_limit_per_mailbox = 2
    try:
        sent = service.send_outreach_batch(limit=3)
    finally:
        settings.daily_send_limit_per_mailbox = original_limit

    assert sent == 2
