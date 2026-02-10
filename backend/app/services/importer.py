from __future__ import annotations

import csv
import io
from typing import Iterable

from app.schemas.types import LeadIn


def parse_leads(content: bytes, filename: str) -> list[LeadIn]:
    text = content.decode("utf-8")
    if filename.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(text))
        return [
            LeadIn(
                name=row.get("name", "").strip(),
                email=row.get("email", "").strip(),
                company=row.get("company") or None,
                position=row.get("position") or None,
                niche=row.get("niche") or None,
                objective=row.get("objective") or None,
            )
            for row in reader
            if row.get("name") and row.get("email")
        ]

    leads = []
    for line in text.splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 2 and "@" in parts[1]:
            leads.append(LeadIn(name=parts[0], email=parts[1]))
    return leads


def dedupe_by_email(leads: Iterable[LeadIn]) -> list[LeadIn]:
    seen = set()
    out = []
    for lead in leads:
        if lead.email not in seen:
            seen.add(lead.email)
            out.append(lead)
    return out
