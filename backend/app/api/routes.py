from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.entities import Alert, EmailMessage, EmailTemplate, Lead, LeadStage
from app.schemas.dto import AlertOut, InboundEmail, LeadIn, LeadOut, TemplateGenerationRequest, TemplateOut
from app.services.analytics_service import AnalyticsService
from app.services.lead_service import LeadService
from app.services.outreach_service import OutreachService
from app.services.template_service import TemplateService

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/leads/import")
async def import_leads(file: UploadFile = File(...), session: Session = Depends(get_session)):
    data = (await file.read()).decode("utf-8")
    result = LeadService(session).import_from_csv(data)
    return result


@router.post("/leads", response_model=LeadOut)
def create_lead(payload: LeadIn, session: Session = Depends(get_session)):
    service = LeadService(session)
    res = service.upsert_leads([payload])
    if res["inserted"] == 0:
        raise HTTPException(status_code=409, detail="Lead already exists")
    lead = session.exec(select(Lead).where(Lead.email == payload.email)).first()
    return lead


@router.get("/leads", response_model=list[LeadOut])
def list_leads(session: Session = Depends(get_session), stage: LeadStage | None = None):
    query = select(Lead)
    if stage:
        query = query.where(Lead.stage == stage)
    return session.exec(query.order_by(Lead.created_at.desc())).all()


@router.post("/templates/generate", response_model=list[TemplateOut])
def generate_templates(payload: TemplateGenerationRequest, session: Session = Depends(get_session)):
    templates = TemplateService(session).generate_outreach_bank(payload)
    return templates


@router.post("/templates/generate-follow-up", response_model=list[TemplateOut])
def generate_follow_up_templates(objective: str, niche: str, count: int = 4, session: Session = Depends(get_session)):
    return TemplateService(session).generate_follow_up_bank(objective, niche, count)


@router.get("/templates", response_model=list[TemplateOut])
def list_templates(session: Session = Depends(get_session)):
    return session.exec(select(EmailTemplate).order_by(EmailTemplate.score.desc())).all()


@router.post("/campaign/send-outreach")
def send_outreach(limit: int = 50, session: Session = Depends(get_session)):
    sent = OutreachService(session).send_outreach_batch(limit)
    return {"sent": sent}


@router.post("/campaign/follow-up")
def send_follow_up(session: Session = Depends(get_session)):
    sent = OutreachService(session).run_follow_up_cycle()
    return {"sent": sent}


@router.post("/inbound")
def inbound(payload: InboundEmail, session: Session = Depends(get_session)):
    lead = session.exec(select(Lead).where(Lead.email == payload.lead_email)).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    service = OutreachService(session)
    message = service.register_inbound(lead, payload.subject, payload.body)
    draft = service.prepare_reply_draft(lead, message)
    return {"inbound_id": message.id, "draft_reply_id": draft.id}


@router.get("/messages")
def list_messages(session: Session = Depends(get_session), lead_id: int | None = None):
    query = select(EmailMessage)
    if lead_id:
        query = query.where(EmailMessage.lead_id == lead_id)
    return session.exec(query.order_by(EmailMessage.sent_at.desc())).all()


@router.get("/stats")
def stats(session: Session = Depends(get_session)):
    return AnalyticsService(session).dashboard_stats()


@router.get("/alerts", response_model=list[AlertOut])
def alerts(session: Session = Depends(get_session)):
    return session.exec(select(Alert).where(Alert.acknowledged.is_(False)).order_by(Alert.created_at.desc())).all()


@router.post("/alerts/{alert_id}/ack")
def ack_alert(alert_id: int, session: Session = Depends(get_session)):
    alert = session.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    session.add(alert)
    session.commit()
    return {"ok": True}


@router.post("/opt-out/{lead_id}")
def opt_out(lead_id: int, reason: str = "No reason", session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.opted_out = True
    lead.stage = LeadStage.opted_out
    lead.updated_at = datetime.utcnow()
    session.add(lead)
    session.add(Alert(severity="info", message=f"{lead.email} opted out: {reason}", lead_id=lead.id))
    session.commit()
    return {"status": "opted_out"}
