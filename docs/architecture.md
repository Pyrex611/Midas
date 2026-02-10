# Midas MVP Architecture

## Components

- **API + Dashboard**: FastAPI routes for lead import, template generation, campaign actions, reply processing.
- **Data Layer**: SQLAlchemy entities for leads, templates, messages, replies, alerts, mailbox usage.
- **Agent Layer**:
  - `OutreachTemplateAgent`: creates outreach template variants.
  - `TemplateQualityAgent`: scores/filters templates.
  - `FollowUpAgent`: drafts follow-up content from prior outreach.
  - `ReplyAgent`: sentiment + suggested replies for inbound responses.
  - `ModelRouter`: provider/model/api-key rotation and premium model reservation.
- **Messaging Layer**:
  - `EmailGateway`: send adapter seam.
  - `InboxSyncService`: inbound polling/webhook seam.

## Low-cost defaults

- SQLite for local deployment.
- Replace with PostgreSQL by setting `MIDAS_DB_URL`.
- Model fallback supports rotating through free-tier keys/models.

## Compliance and anti-spam controls

- De-duplication by email.
- Opt-out support and suppression list behavior.
- Daily sender mailbox cap.
- Template usage balancing.
- Unsubscribe link in outreach and follow-ups.
