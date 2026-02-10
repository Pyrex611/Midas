from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.entities import Lead, Conversation, Alert, Template


def dashboard_stats(db: Session) -> dict:
    total_leads = db.query(func.count(Lead.id)).scalar() or 0
    contacted = db.query(func.count(Lead.id)).filter(Lead.status.in_(["contacted", "replied", "followup_sent"])).scalar() or 0
    replied = db.query(func.count(Lead.id)).filter(Lead.status == "replied").scalar() or 0
    conversions = round((replied / contacted) * 100, 2) if contacted else 0.0
    alerts = db.query(func.count(Alert.id)).filter(Alert.resolved.is_(False)).scalar() or 0
    drafts = db.query(func.count(Template.id)).scalar() or 0
    return {
        "total_leads": total_leads,
        "contacted": contacted,
        "replied": replied,
        "conversion_rate": conversions,
        "open_alerts": alerts,
        "draft_count": drafts,
    }


def sentiment_breakdown(db: Session) -> dict[str, int]:
    rows = db.query(Conversation.sentiment, func.count(Conversation.id)).group_by(Conversation.sentiment).all()
    return {k or "unknown": v for k, v in rows}
