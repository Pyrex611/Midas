from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Iterable
from sqlmodel import Session, select

from app.models.entities import Lead, LeadStage
from app.schemas.dto import LeadIn


class LeadService:
    def __init__(self, session: Session):
        self.session = session

    def upsert_leads(self, leads: Iterable[LeadIn]) -> dict[str, int]:
        inserted = 0
        skipped_existing = 0
        for item in leads:
            existing = self.session.exec(select(Lead).where(Lead.email == item.email)).first()
            if existing:
                skipped_existing += 1
                continue
            lead = Lead(**item.model_dump())
            self.session.add(lead)
            inserted += 1
        self.session.commit()
        return {"inserted": inserted, "skipped_existing": skipped_existing}

    def import_from_csv(self, text: str) -> dict[str, int]:
        reader = csv.DictReader(io.StringIO(text))
        leads = []
        for row in reader:
            if not row.get("email") or not row.get("name"):
                continue
            leads.append(
                LeadIn(
                    name=row["name"],
                    email=row["email"],
                    company=row.get("company"),
                    position=row.get("position"),
                    niche=row.get("niche"),
                    objective=row.get("objective"),
                )
            )
        return self.upsert_leads(leads)

    def mark_stage(self, lead: Lead, stage: LeadStage) -> None:
        lead.stage = stage
        lead.updated_at = datetime.utcnow()
        self.session.add(lead)
        self.session.commit()
