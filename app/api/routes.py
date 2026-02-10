from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Alert, Lead, ReplyMessage
from app.models.schemas import IncomingReply
from app.services.campaign_service import CampaignService
from app.services.lead_importer import LeadImporter

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")


@router.get("/", response_class=HTMLResponse)
def dashboard(request: Request, db: Session = Depends(get_db)):
    service = CampaignService(db)
    metrics = service.metrics()
    leads = db.scalars(select(Lead).order_by(Lead.created_at.desc()).limit(20)).all()
    alerts = db.scalars(select(Alert).order_by(Alert.created_at.desc()).limit(10)).all()
    replies = db.scalars(select(ReplyMessage).order_by(ReplyMessage.received_at.desc()).limit(10)).all()
    return templates.TemplateResponse(
        request,
        "dashboard.html",
        {
            "metrics": metrics,
            "leads": leads,
            "alerts": alerts,
            "replies": replies,
        },
    )


@router.post("/leads/import")
async def import_leads(file: UploadFile = File(...), db: Session = Depends(get_db)):
    payload = await file.read()
    importer = LeadImporter(db)
    rows = importer.parse(file.filename, payload)
    _ = importer.import_rows(rows)
    return RedirectResponse(url="/", status_code=303)


@router.post("/templates/generate")
def generate_templates(objective: str = Form(...), niche: str = Form(""), db: Session = Depends(get_db)):
    service = CampaignService(db)
    service.seed_templates(objective=objective, niche=niche or None)
    return RedirectResponse(url="/", status_code=303)


@router.post("/campaign/send-outreach")
def send_outreach(db: Session = Depends(get_db)):
    service = CampaignService(db)
    service.send_outreach_batch()
    return RedirectResponse(url="/", status_code=303)


@router.post("/campaign/send-followups")
def send_followups(db: Session = Depends(get_db)):
    service = CampaignService(db)
    service.create_followups()
    return RedirectResponse(url="/", status_code=303)


@router.post("/inbox/reply")
def ingest_reply(payload: IncomingReply, db: Session = Depends(get_db)):
    service = CampaignService(db)
    service.process_incoming_reply(payload.lead_email, payload.raw_body)
    return {"status": "ok"}


@router.post("/reply/{lead_id}/approve")
def approve_reply(lead_id: int, db: Session = Depends(get_db)):
    service = CampaignService(db)
    ok = service.approve_and_send_suggested_reply(lead_id)
    return {"sent": ok}


@router.get("/unsubscribe/{email}", response_class=HTMLResponse)
def unsubscribe_page(email: str, request: Request):
    return templates.TemplateResponse(request, "unsubscribe.html", {"email": email})


@router.post("/unsubscribe/{email}")
def unsubscribe_submit(email: str, reason: str = Form(""), db: Session = Depends(get_db)):
    service = CampaignService(db)
    service.unsubscribe(email, reason)
    return HTMLResponse("You have been unsubscribed.")
