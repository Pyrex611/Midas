from apscheduler.schedulers.background import BackgroundScheduler
from app.db.session import session_scope
from app.services.outreach_service import OutreachService

scheduler = BackgroundScheduler()


def schedule_jobs() -> None:
    @scheduler.scheduled_job("interval", minutes=30)
    def outreach_tick():
        with session_scope() as session:
            OutreachService(session).send_outreach_batch(limit=25)

    @scheduler.scheduled_job("interval", hours=6)
    def follow_up_tick():
        with session_scope() as session:
            OutreachService(session).run_follow_up_cycle(hours_since_last_touch=72)

    scheduler.start()
