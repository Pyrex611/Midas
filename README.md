# Midas — Email Outreach + Lead Management MVP

Midas is a production-style MVP for multi-stage outreach automation:
- Lead ingestion (CSV/TXT) + dedupe against existing/opted-out leads
- Template-bank generation with AI agents (outreach + follow-up + reply)
- Outreach/follow-up runs with mailbox usage monitoring
- Inbound reply processing + sentiment + draft reply suggestions
- Dashboard for operations, alerts, and conversion metrics
- Compliance support with unsubscribe/opt-out records

## Stack
- Backend: FastAPI + SQLAlchemy
- DB: SQLite by default (swapable via `MIDAS_DATABASE_URL`)
- Agent layer: Google ADK/Gemini-ready with fallback mode
- Frontend: Minimal static dashboard served by FastAPI

## Quick start
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Open `http://localhost:8000`.

## Config
Set environment variables (optional):
- `MIDAS_GOOGLE_API_KEYS=key1,key2`
- `MIDAS_GOOGLE_MODELS=gemini-2.5-flash,gemini-2.5-flash-lite`
- `MIDAS_DAILY_SEND_LIMIT_PER_MAILBOX=150`

## Follow-up strategy baked into MVP
1. Initial outreach (Day 0)
2. Follow-up #1 (Day 2): value-add + soft CTA
3. Follow-up #2 (Day 5): objection-aware + social proof
4. Follow-up #3 (Day 9): final polite close-the-loop

This MVP automates step #2 and can be extended via scheduler jobs for full cadence.
