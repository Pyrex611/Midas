# Midas

Midas is a deployment-ready MVP for AI-assisted email outreach, follow-up automation, response intelligence, and campaign analytics.

## What it delivers

- Lead import (CSV + API), dedupe by email, and lifecycle tracking.
- Agent-driven template generation + optimizer review loop using `google-adk` Gemini models.
- Model/API-key router with quota preservation for high-value reply drafting.
- Outreach/follow-up workflows with opt-out compliance links.
- Inbound reply ingestion, sentiment tagging, alerting, and reply-draft generation.
- Analytics dashboard for outreach health, conversion funnels, and alert triage.

## Stack

- **Backend:** FastAPI + SQLModel + APScheduler
- **DB:** SQLite by default, PostgreSQL in docker-compose
- **Frontend:** React + Recharts + Vite (minimal gold-accent dashboard)
- **AI:** google-adk agents with Gemini models and fail-safe fallback behavior

## Local run

```bash
cd frontend && npm install && npm run build && cd ..
cd backend && pip install -e . && uvicorn app.main:app --reload
```

Open `http://localhost:8000`.

## Core workflows

1. Import leads: `POST /api/leads/import` (CSV with `name,email,...`).
2. Generate outreach template bank: `POST /api/templates/generate`.
3. Send outreach batch: `POST /api/campaign/send-outreach`.
4. Process inbound replies: `POST /api/inbound`.
5. Run follow-ups: `POST /api/campaign/follow-up`.
6. View dashboard stats + alerts in UI.

## Follow-up scheme (built-in)

- T+3 days: short value reminder with new micro-proof.
- T+7 days: problem reframing + low-friction CTA.
- T+14 days: breakup-style final touch with permission-based close.
- Stop immediately on opt-out or negative sentiment.

## Notes on email operations

- Every outbound body includes unsubscribe links.
- Template bank stores scored variants for rotational sending.
- Reply drafting reserves premium Gemini quota for inbound responses.
