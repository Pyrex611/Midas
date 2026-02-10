from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.schemas.types import CampaignConfig
from app.services.campaign import CampaignService

scheduler = BackgroundScheduler()


def followup_job():
    db: Session = SessionLocal()
    try:
        CampaignService(db).run_followups(CampaignConfig(objective="pipeline expansion"))
    finally:
        db.close()


def start_scheduler():
    if not scheduler.running:
        scheduler.add_job(followup_job, "interval", hours=12, id="followup")
        scheduler.start()
