from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from app.models.entities import LeadStage, Sentiment, TemplateType


class LeadIn(BaseModel):
    name: str
    email: EmailStr
    company: Optional[str] = None
    position: Optional[str] = None
    niche: Optional[str] = None
    objective: Optional[str] = None


class LeadOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    company: Optional[str]
    position: Optional[str]
    niche: Optional[str]
    objective: Optional[str]
    stage: LeadStage
    opted_out: bool


class TemplateGenerationRequest(BaseModel):
    objective: str
    niche: str
    tone: str = "professional"
    count: int = 8
    include_research_variant: bool = True


class TemplateOut(BaseModel):
    id: int
    name: str
    template_type: TemplateType
    subject: str
    body: str
    score: float
    tags: str


class ReplyPolicy(BaseModel):
    auto_send_positive: bool = True
    auto_send_neutral: bool = False
    auto_send_negative: bool = False


class InboundEmail(BaseModel):
    lead_email: EmailStr
    subject: str
    body: str


class StatsOut(BaseModel):
    leads_total: int
    leads_contacted: int
    leads_replied: int
    leads_converted: int
    opt_out_rate: float
    response_rate: float
    templates_count: int
    follow_ups_sent: int


class AlertOut(BaseModel):
    id: int
    severity: str
    message: str
    lead_id: Optional[int]
    created_at: datetime
