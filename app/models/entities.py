from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class LeadStatus(str, enum.Enum):
    new = "new"
    outreached = "outreached"
    replied = "replied"
    follow_up_due = "follow_up_due"
    closed = "closed"
    opted_out = "opted_out"


class EmailType(str, enum.Enum):
    outreach = "outreach"
    follow_up = "follow_up"
    reply = "reply"


class Sentiment(str, enum.Enum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    company: Mapped[str | None] = mapped_column(String(150), nullable=True)
    position: Mapped[str | None] = mapped_column(String(150), nullable=True)
    niche: Mapped[str | None] = mapped_column(String(150), nullable=True)
    status: Mapped[LeadStatus] = mapped_column(Enum(LeadStatus), default=LeadStatus.new, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_contacted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    opt_out: Mapped[bool] = mapped_column(Boolean, default=False)

    emails: Mapped[list[EmailMessage]] = relationship("EmailMessage", back_populates="lead")


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email_type: Mapped[EmailType] = mapped_column(Enum(EmailType), index=True)
    objective: Mapped[str] = mapped_column(String(200), nullable=False)
    subject_template: Mapped[str] = mapped_column(String(255), nullable=False)
    body_template: Mapped[str] = mapped_column(Text, nullable=False)
    quality_score: Mapped[float] = mapped_column(Float, default=0.0)
    conversion_score: Mapped[float] = mapped_column(Float, default=0.0)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class EmailMessage(Base):
    __tablename__ = "email_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True)
    template_id: Mapped[int | None] = mapped_column(ForeignKey("email_templates.id"), nullable=True)
    email_type: Mapped[EmailType] = mapped_column(Enum(EmailType), index=True)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    external_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    lead: Mapped[Lead] = relationship("Lead", back_populates="emails")


class ReplyMessage(Base):
    __tablename__ = "reply_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True)
    raw_body: Mapped[str] = mapped_column(Text, nullable=False)
    sentiment: Mapped[Sentiment] = mapped_column(Enum(Sentiment), default=Sentiment.neutral)
    suggested_reply_subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    suggested_reply_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggested_reply_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"), nullable=True)
    severity: Mapped[str] = mapped_column(String(20), default="info")
    message: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MailboxUsage(Base):
    __tablename__ = "mailbox_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sender_email: Mapped[str] = mapped_column(String(255), index=True)
    day: Mapped[str] = mapped_column(String(20), index=True)
    count_sent: Mapped[int] = mapped_column(Integer, default=0)
