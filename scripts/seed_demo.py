from app.db.session import init_db, get_session
from app.services.campaign_service import CampaignService
from app.services.lead_importer import LeadImporter


def main() -> None:
    init_db()
    db = get_session()
    importer = LeadImporter(db)
    importer.import_rows(
        [
            {"name": "Ada Lovelace", "email": "ada@example.com", "company": "Analytical Engines", "niche": "SaaS"},
            {"name": "Grace Hopper", "email": "grace@example.com", "company": "Compiler Co", "niche": "DevTools"},
        ]
    )
    service = CampaignService(db)
    service.seed_templates("book discovery calls", "SaaS")
    service.send_outreach_batch()
    print("Demo data seeded")


if __name__ == "__main__":
    main()
