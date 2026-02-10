from __future__ import annotations

import csv
import io
import json
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Lead
from app.models.schemas import LeadImportResult


class LeadImporter:
    def __init__(self, db: Session) -> None:
        self.db = db

    def parse(self, filename: str, payload: bytes) -> Iterable[dict[str, str]]:
        lower = filename.lower()
        text = payload.decode("utf-8")
        if lower.endswith(".csv"):
            reader = csv.DictReader(io.StringIO(text))
            return [dict(row) for row in reader]
        if lower.endswith(".json"):
            return json.loads(text)
        if lower.endswith(".txt"):
            rows = []
            for line in text.splitlines():
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 2:
                    rows.append({"name": parts[0], "email": parts[1]})
            return rows
        raise ValueError("Unsupported file type. Use CSV, JSON, or TXT.")

    def import_rows(self, rows: Iterable[dict[str, str]]) -> LeadImportResult:
        inserted = skipped_existing = skipped_opted_out = 0
        for row in rows:
            email = (row.get("email") or "").strip().lower()
            name = (row.get("name") or "").strip()
            if not email or not name:
                continue
            existing = self.db.scalar(select(Lead).where(Lead.email == email))
            if existing:
                if existing.opt_out:
                    skipped_opted_out += 1
                else:
                    skipped_existing += 1
                continue
            lead = Lead(
                name=name,
                email=email,
                company=(row.get("company") or "").strip() or None,
                position=(row.get("position") or "").strip() or None,
                niche=(row.get("niche") or "").strip() or None,
            )
            self.db.add(lead)
            inserted += 1
        self.db.commit()
        return LeadImportResult(
            inserted=inserted,
            skipped_existing=skipped_existing,
            skipped_opted_out=skipped_opted_out,
        )
