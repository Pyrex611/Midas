from __future__ import annotations

from pydantic import BaseModel, EmailStr

from app.models.entities import EmailType, Sentiment


class LeadIn(BaseModel):
    name: str
    email: EmailStr
    company: str | None = None
    position: str | None = None
    niche: str | None = None


class LeadImportResult(BaseModel):
    inserted: int
    skipped_existing: int
    skipped_opted_out: int
    invalid_rows: int


class LeadOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    company: str | None
    position: str | None
    niche: str | None
    status: str
    created_at: str


class LeadListResponse(BaseModel):
    total: int
    leads: list[LeadOut]


class DraftEmail(BaseModel):
    subject: str
    body: str
    email_type: EmailType


class IncomingReply(BaseModel):
    lead_email: EmailStr
    raw_body: str


class ReplyAnalysis(BaseModel):
    sentiment: Sentiment
    subject: str
    body: str


class DashboardMetrics(BaseModel):
    total_leads: int
    outreached: int
    replied: int
    follow_up_due: int
    conversion_rate: float
    templates_total: int
