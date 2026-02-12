from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Alert, Lead, LeadStatus, ReplyMessage
from app.models.schemas import IncomingReply, LeadImportResult, LeadListResponse, LeadOut
from app.services.campaign_service import CampaignService
from app.services.lead_importer import LeadImporter

router = APIRouter()
api_router = APIRouter(prefix="/api/v1", tags=["api"])
templates = Jinja2Templates(directory="app/templates")


@router.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    return templates.TemplateResponse(request, "dashboard.html", {})


@router.post("/leads/import")
async def import_leads(file: UploadFile = File(...), db: Session = Depends(get_db)):
    payload = await file.read()
    importer = LeadImporter(db)
    rows = importer.parse(file.filename or "upload", payload)
    _ = importer.import_rows(rows)
    return RedirectResponse(url="/", status_code=303)


@api_router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@api_router.get("/dashboard")
def dashboard_data(db: Session = Depends(get_db)):
    service = CampaignService(db)
    metrics = service.metrics()
    alerts = db.scalars(select(Alert).order_by(Alert.created_at.desc()).limit(10)).all()
    replies = db.scalars(select(ReplyMessage).order_by(ReplyMessage.received_at.desc()).limit(10)).all()
    return {
        "metrics": metrics.model_dump(),
        "alerts": [
            {
                "id": item.id,
                "severity": item.severity,
                "message": item.message,
                "created_at": item.created_at.isoformat(),
            }
            for item in alerts
        ],
        "replies": [
            {
                "id": reply.id,
                "lead_id": reply.lead_id,
                "sentiment": reply.sentiment.value,
                "received_at": reply.received_at.isoformat(),
            }
            for reply in replies
        ],
    }


@api_router.get("/leads", response_model=LeadListResponse)
def list_leads(
    db: Session = Depends(get_db),
    status: LeadStatus | None = Query(default=None),
    search: str = Query(default="", min_length=0, max_length=255),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    query = select(Lead)
    count_query = select(func.count()).select_from(Lead)

    if status:
        query = query.where(Lead.status == status)
        count_query = count_query.where(Lead.status == status)

    search_value = search.strip()
    if search_value:
        pattern = f"%{search_value}%"
        query = query.where((Lead.email.ilike(pattern)) | (Lead.name.ilike(pattern)) | (Lead.company.ilike(pattern)))
        count_query = count_query.where((Lead.email.ilike(pattern)) | (Lead.name.ilike(pattern)) | (Lead.company.ilike(pattern)))

    total = db.scalar(count_query) or 0
    leads = db.scalars(query.order_by(Lead.created_at.desc()).offset(offset).limit(limit)).all()

    return LeadListResponse(
        total=total,
        leads=[
            LeadOut(
                id=lead.id,
                name=lead.name,
                email=lead.email,
                company=lead.company,
                position=lead.position,
                niche=lead.niche,
                status=lead.status.value,
                created_at=lead.created_at.isoformat(),
            )
            for lead in leads
        ],
    )


@api_router.post("/leads/import", response_model=LeadImportResult)
async def import_leads_api(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file must include a filename.")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    importer = LeadImporter(db)
    try:
        rows = importer.parse(file.filename, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return importer.import_rows(rows)


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
    return {"status": "ok", "received_at": datetime.utcnow().isoformat()}


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
