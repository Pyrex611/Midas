from __future__ import annotations

from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Lead, Conversation, Alert, Template
from app.schemas.types import CampaignConfig, ReplyPolicy
from app.services.analytics import dashboard_stats, sentiment_breakdown
from app.services.campaign import CampaignService
from app.services.importer import parse_leads, dedupe_by_email
from app.models.entities import TemplateType
from app.utils.serializers import lead_to_dict, convo_to_dict, alert_to_dict, template_to_dict

router = APIRouter()


@router.get("/health")
def health():
    return {"ok": True}


@router.post("/leads/import")
async def import_leads(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    parsed = parse_leads(content, file.filename)
    parsed = dedupe_by_email(parsed)
    svc = CampaignService(db)
    result = svc.add_leads([p.model_dump() for p in parsed])
    return {"parsed": len(parsed), **result}


@router.post("/campaign/templates/bootstrap")
def bootstrap_templates(config: CampaignConfig, db: Session = Depends(get_db)):
    svc = CampaignService(db)
    svc.generate_template_bank(config, count=8)
    svc.generate_template_bank(config, count=4, template_type=TemplateType.followup)
    return {"ok": True}


@router.post("/campaign/outreach/run")
def run_outreach(config: CampaignConfig, db: Session = Depends(get_db)):
    return CampaignService(db).run_outreach(config)


@router.post("/campaign/followups/run")
def run_followups(config: CampaignConfig, db: Session = Depends(get_db)):
    return CampaignService(db).run_followups(config)


@router.post("/replies/process")
def process_reply(payload: dict, db: Session = Depends(get_db)):
    cfg = CampaignConfig(**payload.get("config", {"objective": "general growth"}))
    policy = ReplyPolicy(**payload.get("policy", {}))
    return CampaignService(db).process_inbound_reply(payload["email"], payload.get("subject", "Re:"), payload["body"], policy, cfg)


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    return {
        "stats": dashboard_stats(db),
        "sentiment": sentiment_breakdown(db),
        "leads": [lead_to_dict(x) for x in db.query(Lead).order_by(Lead.created_at.desc()).limit(50).all()],
        "conversations": [convo_to_dict(x) for x in db.query(Conversation).order_by(Conversation.created_at.desc()).limit(50).all()],
        "alerts": [alert_to_dict(x) for x in db.query(Alert).filter(Alert.resolved.is_(False)).order_by(Alert.created_at.desc()).limit(20).all()],
        "templates": [template_to_dict(x) for x in db.query(Template).order_by(Template.score.desc()).limit(20).all()],
    }


@router.post("/opt-out")
def opt_out(payload: dict, db: Session = Depends(get_db)):
    return CampaignService(db).apply_opt_out(payload["email"], payload.get("reason"))
