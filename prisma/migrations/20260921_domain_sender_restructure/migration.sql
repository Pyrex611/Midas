-- Domain/Sender restructure: splits per-mailbox sending identity + quota
-- (Sender) out of Domain (which becomes purely DNS/credential identity),
-- and replaces CampaignDomain with CampaignSender.
--
-- IMPORTANT: this migration PRESERVES existing domain/campaign data by
-- backfilling one Sender per existing Domain (using its old
-- sender_local_part/daily_limit/warmup_day/sent_count_today) and one
-- CampaignSender per existing CampaignDomain row, BEFORE dropping the old
-- columns/table. If your deploy pipeline uses `prisma db push
-- --accept-data-loss` (check package.json's "vercel-build" script), db push
-- does NOT run this backfill logic — it would just drop the old columns and
-- lose this data. Run this file manually against your database (e.g. via
-- `psql "$DATABASE_URL" -f prisma/migrations/20260921_domain_sender_restructure/migration.sql`)
-- BEFORE your next deploy, or switch "vercel-build" to use
-- `prisma migrate deploy` instead of `prisma db push` going forward (see
-- INTEGRATION.md for the exact script change).

BEGIN;

-- 1. New tables
CREATE TABLE "Sender" (
  "id"               TEXT PRIMARY KEY,
  "domain_id"        TEXT NOT NULL REFERENCES "Domain"("id") ON DELETE CASCADE,
  "user_id"          UUID NOT NULL,
  "local_part"       TEXT NOT NULL,
  "display_name"     TEXT,
  "status"           TEXT NOT NULL DEFAULT 'active',
  "warmup_day"       INTEGER NOT NULL DEFAULT 1,
  "daily_limit"      INTEGER NOT NULL DEFAULT 20,
  "sent_count_today" INTEGER NOT NULL DEFAULT 0,
  "last_sent_reset"  TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX "Sender_domain_id_local_part_key" ON "Sender"("domain_id", "local_part");
CREATE INDEX "Sender_user_id_idx" ON "Sender"("user_id");

CREATE TABLE "CampaignSender" (
  "id"          TEXT PRIMARY KEY,
  "campaign_id" TEXT NOT NULL REFERENCES "Campaign"("id") ON DELETE CASCADE,
  "sender_id"   TEXT NOT NULL REFERENCES "Sender"("id") ON DELETE CASCADE,
  "added_at"    TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX "CampaignSender_campaign_id_sender_id_key" ON "CampaignSender"("campaign_id", "sender_id");

-- 2. Backfill: one Sender per existing Domain, carrying over its old
-- sending identity/quota fields.
INSERT INTO "Sender" ("id", "domain_id", "user_id", "local_part", "status", "warmup_day", "daily_limit", "sent_count_today", "last_sent_reset", "created_at", "updated_at")
SELECT
  'sender_' || substr(md5(random()::text || d."id"), 1, 20),
  d."id",
  d."user_id",
  COALESCE(d."sender_local_part", 'hello'),
  'active',
  COALESCE(d."warmupDay", 1),
  COALESCE(d."dailyLimit", 20),
  COALESCE(d."sentCountToday", 0),
  COALESCE(d."last_sent_reset", NOW()),
  NOW(), NOW()
FROM "Domain" d;

-- 3. Backfill: one CampaignSender per existing CampaignDomain, pointing at
-- the Sender created above for that domain.
INSERT INTO "CampaignSender" ("id", "campaign_id", "sender_id", "added_at")
SELECT
  'csend_' || substr(md5(random()::text || cd."id"), 1, 20),
  cd."campaign_id",
  s."id",
  cd."added_at"
FROM "CampaignDomain" cd
JOIN "Sender" s ON s."domain_id" = cd."domain_id";

-- 4. New Domain columns for the real send/receive connectivity test and
-- per-domain Mailgun region override.
ALTER TABLE "Domain" ADD COLUMN "mailgun_region" TEXT;
ALTER TABLE "Domain" ADD COLUMN "send_test_passed_at" TIMESTAMP(3);
ALTER TABLE "Domain" ADD COLUMN "receiving_test_code" TEXT;
ALTER TABLE "Domain" ADD COLUMN "receiving_test_address" TEXT;
ALTER TABLE "Domain" ADD COLUMN "receiving_confirmed_at" TIMESTAMP(3);

-- Any domain that was already "active" under the old model is assumed to
-- have working send capability (it was sending before this migration) —
-- mark its send test as already passed so existing campaigns keep working
-- without forcing a re-verification.
UPDATE "Domain" SET "send_test_passed_at" = NOW() WHERE "status" = 'active';
UPDATE "Domain" SET "status" = 'pending_setup' WHERE "status" NOT IN ('active', 'paused_health_risk');

-- 5. Drop old per-domain sending-identity/quota columns (now on Sender).
ALTER TABLE "Domain" DROP COLUMN IF EXISTS "sender_local_part";
ALTER TABLE "Domain" DROP COLUMN IF EXISTS "warmupDay";
ALTER TABLE "Domain" DROP COLUMN IF EXISTS "dailyLimit";
ALTER TABLE "Domain" DROP COLUMN IF EXISTS "sentCountToday";
ALTER TABLE "Domain" DROP COLUMN IF EXISTS "last_sent_reset";

-- 6. PendingEmail: preferred_sender_id replaces preferred_domain_id.
ALTER TABLE "PendingEmail" ADD COLUMN "preferred_sender_id" TEXT REFERENCES "Sender"("id") ON DELETE SET NULL;
ALTER TABLE "PendingEmail" DROP COLUMN IF EXISTS "preferred_domain_id";

-- 7. Drop the now-replaced CampaignDomain table.
DROP TABLE IF EXISTS "CampaignDomain";

COMMIT;
