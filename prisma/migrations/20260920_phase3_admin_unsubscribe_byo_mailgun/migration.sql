-- Cross-tenant admin visibility (Phase 3)
ALTER TABLE "users" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- Real one-click unsubscribe support
ALTER TABLE "Lead" ADD COLUMN "unsubscribe_token" TEXT;
CREATE UNIQUE INDEX "Lead_unsubscribe_token_key" ON "Lead"("unsubscribe_token");

-- Bring-your-own-Mailgun-account support (per-domain encrypted key override)
ALTER TABLE "Domain" ADD COLUMN "mailgun_api_key_encrypted" TEXT;
