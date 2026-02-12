# Midas

Midas is a production-oriented platform for autonomous cold outreach operations. This iteration ships a robust **lead ingestion and storage foundation** with a modern UX and API-first backend.

## What this base includes

- Multi-format lead upload: **CSV / TXT / JSON / XLSX**
- Field normalization for common header variations (`full_name`, `email_address`, `job_title`, etc.)
- Database-backed deduplication and opt-out safeguards
- Lead inventory browsing with search + status filters
- API-first backend designed for separate frontend/backend deployments
- Standalone frontend bundle (`/frontend`) that can run on a different host from the API

## Stack

- Backend: FastAPI + SQLAlchemy
- Database: SQLite by default (PostgreSQL-ready)
- Frontend: static app (HTML/CSS/JS) with API integration

## Quickstart

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000` for the integrated dashboard.

To host frontend separately:

1. Serve `frontend/` on any static host.
2. Set `window.MIDAS_API_BASE` in `frontend/index.html` to your backend URL.
3. Configure backend CORS via `MIDAS_CORS_ALLOWED_ORIGINS`.

## API endpoints (lead foundation)

- `GET /api/v1/health`
- `GET /api/v1/dashboard`
- `GET /api/v1/leads?status=&search=&limit=&offset=`
- `POST /api/v1/leads/import` (multipart `file`)

## Environment

- `MIDAS_DB_URL` (default: `sqlite:///./midas.db`)
- `MIDAS_CORS_ALLOWED_ORIGINS` (default: `*`, comma-separated)
- `MIDAS_SENDER_EMAIL` (default: `hello@midas.local`)
- `MIDAS_DAILY_SEND_LIMIT_PER_MAILBOX` (default: `80`)
- `MIDAS_REPLY_AUTO_SEND_DELAY_MINUTES` (default: `60`)
- `MIDAS_MODEL_CONFIG` JSON list for model/key rotation
