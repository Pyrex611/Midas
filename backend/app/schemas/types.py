from datetime import datetime
from pydantic import BaseModel, EmailStr


class LeadIn(BaseModel):
    name: str
    email: EmailStr
    company: str | None = None
    position: str | None = None
    niche: str | None = None
    objective: str | None = None


class LeadOut(LeadIn):
    id: int
    status: str
    opted_out: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TemplateIn(BaseModel):
    name: str
    template_type: str
    subject: str
    body: str
    tags: str | None = None


class CampaignConfig(BaseModel):
    objective: str
    tone: str = "professional"
    cta: str = "15-minute call"
    user_name: str = "Midas User"
    signature: str = "Best regards"
    auto_reply_enabled: bool = False


class ReplyPolicy(BaseModel):
    positive: str = "Book a discovery call and share calendar link"
    neutral: str = "Answer objections and ask one qualifying question"
    negative: str = "Politely disengage and offer opt-out"
