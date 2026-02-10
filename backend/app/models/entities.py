from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from sqlmodel import Field, SQLModel


class LeadStage(str, Enum):
    new = "new"
    contacted = "contacted"
    replied = "replied"
    follow_up_due = "follow_up_due"
    converted = "converted"
    opted_out = "opted_out"


class Sentiment(str, Enum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"


class TemplateType(str, Enum):
    outreach = "outreach"
    follow_up = "follow_up"
    reply = "reply"


class Lead(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    name: str
    company: Optional[str] = None
    position: Optional[str] = None
    niche: Optional[str] = None
    objective: Optional[str] = None
    stage: LeadStage = Field(default=LeadStage.new)
    opted_out: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class EmailTemplate(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    template_type: TemplateType
    subject: str
    body: str
    score: float = 0.0
    tags: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


class EmailMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: int = Field(index=True)
    template_id: Optional[int] = None
    direction: str = Field(index=True)  # outbound or inbound
    kind: str = Field(index=True)  # outreach, follow_up, reply
    subject: str
    body: str
    sender_email: str
    recipient_email: str
    sentiment: Optional[Sentiment] = None
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    message_id: str = Field(index=True, unique=True)


class ApiUsage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    provider: str = "google"
    model_name: str
    api_key_alias: str
    requests_made: int = 0
    tokens_estimate: int = 0
    last_used_at: datetime = Field(default_factory=datetime.utcnow)
    daily_limit: int = 150


class OutboxEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: int = Field(index=True)
    event_type: str = Field(index=True)
    payload: str
    status: str = Field(default="pending")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Alert(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    severity: str = "info"
    message: str
    lead_id: Optional[int] = None
    acknowledged: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
