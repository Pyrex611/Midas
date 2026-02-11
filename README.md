# Midas

Midas is a production-oriented MVP for automated cold outreach, follow-up orchestration, and reply handling. It combines:

- **Lead ingestion** (CSV/TXT/JSON)
- **De-duplication** against prior contacts and opt-outs
- **Template generation/optimization agents**
- **Outreach sending and follow-up sequencing**
- **Reply sentiment analysis + draft response generation**
- **Dashboard** with campaign metrics, alerts, and controls
- **Provider/model failover** (API key/model rotation)

## Stack

- FastAPI + Jinja dashboard
- SQLAlchemy + SQLite (swap-ready for PostgreSQL)
- Agent layer with pluggable providers (Google ADK/Gemini-ready interfaces)

## Quickstart

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000`.

## Environment

Set optional env vars:

- `MIDAS_DB_URL` (default: `sqlite:///./midas.db`)
- `MIDAS_SENDER_EMAIL` (default: `hello@midas.local`)
- `MIDAS_DAILY_SEND_LIMIT_PER_MAILBOX` (default: `80`)
- `MIDAS_REPLY_AUTO_SEND_DELAY_MINUTES` (default: `60`)
- `MIDAS_MODEL_CONFIG` JSON list for model/key rotation (see `app/core/config.py`)

## Notes

- Email sending and inbound sync use adapter interfaces with a safe local logger implementation by default.
- Replace adapters in `app/services/email_gateway.py` and `app/services/inbox_sync.py` for SMTP/IMAP, Gmail API, SES, etc.
