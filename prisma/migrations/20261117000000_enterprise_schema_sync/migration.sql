-- Idempotent synchronization migration capturing all Phase A-E schema models,
-- columns, indexes, and foreign keys cleanly for prisma migrate deploy.

-- 1. Ensure CampaignRole enum exists
DO $$ BEGIN
  CREATE TYPE "CampaignRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Base & Extended Tables
CREATE TABLE IF NOT EXISTS "users" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"             TEXT,
  "email"            TEXT NOT NULL,
  "password"         TEXT,
  "clerk_id"         TEXT,
  "supabase_auth_id" TEXT,
  "is_admin"         BOOLEAN NOT NULL DEFAULT false,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerk_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supabase_auth_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_id_key" ON "users"("clerk_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_supabase_auth_id_key" ON "users"("supabase_auth_id");

CREATE TABLE IF NOT EXISTS "Subscription" (
  "id"                     TEXT PRIMARY KEY,
  "user_id"                UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "plan"                   TEXT NOT NULL DEFAULT 'SCOUT',
  "status"                 TEXT NOT NULL DEFAULT 'ACTIVE',
  "billing_cycle"          TEXT NOT NULL DEFAULT 'monthly',
  "dodo_customer_id"       TEXT,
  "dodo_subscription_id"   TEXT UNIQUE,
  "current_period_start"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "current_period_end"     TIMESTAMP(3),
  "cancel_at_period_end"   BOOLEAN NOT NULL DEFAULT false,
  "ai_credits_used"        INTEGER NOT NULL DEFAULT 0,
  "emails_sent_this_month" INTEGER NOT NULL DEFAULT 0,
  "period_reset_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Domain" (
  "id"                        TEXT PRIMARY KEY,
  "user_id"                   UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "domain_name"               TEXT NOT NULL UNIQUE,
  "status"                    TEXT NOT NULL DEFAULT 'pending_setup',
  "esp_provider"              TEXT NOT NULL DEFAULT 'mailgun',
  "dkimStatus"                BOOLEAN NOT NULL DEFAULT false,
  "spfStatus"                 BOOLEAN NOT NULL DEFAULT false,
  "mxStatus"                  BOOLEAN NOT NULL DEFAULT false,
  "trackingStatus"            BOOLEAN NOT NULL DEFAULT false,
  "dnsRecords"                TEXT,
  "mailgun_api_key_encrypted" TEXT,
  "smtp_config_encrypted"     TEXT,
  "mailgun_region"            TEXT,
  "tracking_domain"           TEXT,
  "tracking_hostname_status"  TEXT,
  "send_test_passed_at"       TIMESTAMP(3),
  "receiving_test_code"       TEXT,
  "receiving_test_address"    TEXT,
  "receiving_confirmed_at"    TIMESTAMP(3),
  "bounce_count"              INTEGER NOT NULL DEFAULT 0,
  "reply_count"               INTEGER NOT NULL DEFAULT 0,
  "bounceRate"                DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "complaintRate"             DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "route_id"                  TEXT,
  "bimi_enabled"              BOOLEAN NOT NULL DEFAULT false,
  "bimi_svg_url"              TEXT,
  "bimi_vmc_url"              TEXT,
  "dmarc_policy"              TEXT,
  "created_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "Domain" ADD COLUMN IF NOT EXISTS "esp_provider" TEXT NOT NULL DEFAULT 'mailgun';
ALTER TABLE "Domain" ADD COLUMN IF NOT EXISTS "smtp_config_encrypted" TEXT;
ALTER TABLE "Domain" ADD COLUMN IF NOT EXISTS "tracking_domain" TEXT;
ALTER TABLE "Domain" ADD COLUMN IF NOT EXISTS "tracking_hostname_status" TEXT;
ALTER TABLE "Domain" ADD COLUMN IF NOT EXISTS "bimi_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Domain" ADD COLUMN IF NOT EXISTS "bimi_svg_url" TEXT;
ALTER TABLE "Domain" ADD COLUMN IF NOT EXISTS "bimi_vmc_url" TEXT;
ALTER TABLE "Domain" ADD COLUMN IF NOT EXISTS "dmarc_policy" TEXT;
CREATE INDEX IF NOT EXISTS "Domain_user_id_idx" ON "Domain"("user_id");

CREATE TABLE IF NOT EXISTS "DomainHealthSnapshot" (
  "id"               TEXT PRIMARY KEY,
  "domain_id"        TEXT NOT NULL REFERENCES "Domain"("id") ON DELETE CASCADE,
  "snapshot_date"    TEXT NOT NULL,
  "sent_count"       INTEGER NOT NULL DEFAULT 0,
  "raw_open_count"   INTEGER NOT NULL DEFAULT 0,
  "human_open_count" INTEGER NOT NULL DEFAULT 0,
  "click_count"      INTEGER NOT NULL DEFAULT 0,
  "reply_count"      INTEGER NOT NULL DEFAULT 0,
  "bounce_count"     INTEGER NOT NULL DEFAULT 0,
  "complaint_count"  INTEGER NOT NULL DEFAULT 0,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "DomainHealthSnapshot_domain_id_snapshot_date_key" ON "DomainHealthSnapshot"("domain_id", "snapshot_date");
CREATE INDEX IF NOT EXISTS "DomainHealthSnapshot_domain_id_idx" ON "DomainHealthSnapshot"("domain_id");

CREATE TABLE IF NOT EXISTS "Sender" (
  "id"                 TEXT PRIMARY KEY,
  "domain_id"          TEXT NOT NULL REFERENCES "Domain"("id") ON DELETE CASCADE,
  "user_id"            UUID NOT NULL,
  "local_part"         TEXT NOT NULL,
  "display_name"       TEXT,
  "status"             TEXT NOT NULL DEFAULT 'active',
  "warmup_day"         INTEGER NOT NULL DEFAULT 1,
  "daily_limit"        INTEGER NOT NULL DEFAULT 20,
  "sent_count_today"   INTEGER NOT NULL DEFAULT 0,
  "last_sent_reset"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_dispatched_at" TIMESTAMP(3),
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "Sender" ADD COLUMN IF NOT EXISTS "last_dispatched_at" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "Sender_domain_id_local_part_key" ON "Sender"("domain_id", "local_part");
CREATE INDEX IF NOT EXISTS "Sender_user_id_idx" ON "Sender"("user_id");

CREATE TABLE IF NOT EXISTS "KnowledgeBase" (
  "id"          TEXT PRIMARY KEY,
  "user_id"     UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "is_default"  BOOLEAN NOT NULL DEFAULT false,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "KnowledgeBase_user_id_idx" ON "KnowledgeBase"("user_id");

CREATE TABLE IF NOT EXISTS "KnowledgeResource" (
  "id"                TEXT PRIMARY KEY,
  "knowledge_base_id" TEXT NOT NULL REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE,
  "user_id"           UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title"             TEXT NOT NULL,
  "source_type"       TEXT NOT NULL DEFAULT 'TEXT',
  "source_url"        TEXT,
  "file_url"          TEXT,
  "mime_type"         TEXT,
  "content"           TEXT NOT NULL,
  "is_active"         BOOLEAN NOT NULL DEFAULT true,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "KnowledgeResource_knowledge_base_id_idx" ON "KnowledgeResource"("knowledge_base_id");
CREATE INDEX IF NOT EXISTS "KnowledgeResource_user_id_idx" ON "KnowledgeResource"("user_id");

ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "last_domain_index" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "target_tool" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "extended_objective" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "knowledge_base_id" TEXT;
CREATE INDEX IF NOT EXISTS "Campaign_knowledge_base_id_idx" ON "Campaign"("knowledge_base_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Campaign_knowledge_base_id_fkey') THEN
    ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_knowledge_base_id_fkey"
      FOREIGN KEY ("knowledge_base_id") REFERENCES "KnowledgeBase"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Blocklist" (
  "id"         TEXT PRIMARY KEY,
  "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "pattern"    TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Blocklist_user_id_pattern_key" ON "Blocklist"("user_id", "pattern");

CREATE TABLE IF NOT EXISTS "UploadJob" (
  "id"             TEXT PRIMARY KEY,
  "user_id"        UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "filename"       TEXT NOT NULL,
  "blobUrl"        TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "error"          TEXT,
  "totalRows"      INTEGER NOT NULL DEFAULT 0,
  "validLeads"     INTEGER NOT NULL DEFAULT 0,
  "catchAllLeads"  INTEGER NOT NULL DEFAULT 0,
  "invalidLeads"   INTEGER NOT NULL DEFAULT 0,
  "blockedLeads"   INTEGER NOT NULL DEFAULT 0,
  "duplicates"     INTEGER NOT NULL DEFAULT 0,
  "verificationId" TEXT,
  "verify_emails"  BOOLEAN NOT NULL DEFAULT false,
  "pendingRows"    TEXT,
  "column_mapping" TEXT,
  "campaign_id"    TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "UploadJob" ADD COLUMN IF NOT EXISTS "verify_emails" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UploadJob" ADD COLUMN IF NOT EXISTS "pendingRows" TEXT;
ALTER TABLE "UploadJob" ADD COLUMN IF NOT EXISTS "column_mapping" TEXT;
ALTER TABLE "UploadJob" ADD COLUMN IF NOT EXISTS "campaign_id" TEXT;
CREATE INDEX IF NOT EXISTS "UploadJob_user_id_idx" ON "UploadJob"("user_id");
CREATE INDEX IF NOT EXISTS "UploadJob_status_idx" ON "UploadJob"("status");

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "verification_status" TEXT NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "unsubscribe_token" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "enriched_data" JSONB;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "enriched_at" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_unsubscribe_token_key" ON "Lead"("unsubscribe_token");

CREATE TABLE IF NOT EXISTS "LeadActivityEvent" (
  "id"          TEXT PRIMARY KEY,
  "lead_id"     TEXT NOT NULL REFERENCES "Lead"("id") ON DELETE CASCADE,
  "campaign_id" TEXT,
  "event_type"  TEXT NOT NULL,
  "metadata"    JSONB,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LeadActivityEvent_lead_id_event_type_idx" ON "LeadActivityEvent"("lead_id", "event_type");
CREATE INDEX IF NOT EXISTS "LeadActivityEvent_campaign_id_created_at_idx" ON "LeadActivityEvent"("campaign_id", "created_at");

ALTER TABLE "OutboundEmail" ADD COLUMN IF NOT EXISTS "domain_id" TEXT;
ALTER TABLE "OutboundEmail" ADD COLUMN IF NOT EXISTS "sender_id" TEXT;
ALTER TABLE "OutboundEmail" ADD COLUMN IF NOT EXISTS "clicked_at" TIMESTAMP(3);
ALTER TABLE "OutboundEmail" ADD COLUMN IF NOT EXISTS "bounced_at" TIMESTAMP(3);
ALTER TABLE "OutboundEmail" ADD COLUMN IF NOT EXISTS "spam_complaint" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "OutboundEmail_sender_id_idx" ON "OutboundEmail"("sender_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutboundEmail_sender_id_fkey') THEN
    ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_sender_id_fkey"
      FOREIGN KEY ("sender_id") REFERENCES "Sender"("id") ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE "PendingEmail" ADD COLUMN IF NOT EXISTS "domain_id" TEXT;
ALTER TABLE "PendingEmail" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PendingEmail" ADD COLUMN IF NOT EXISTS "preferred_sender_id" TEXT;
CREATE INDEX IF NOT EXISTS "PendingEmail_status_scheduled_at_idx" ON "PendingEmail"("status", "scheduled_at");

ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "send_limit" INTEGER;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "send_period" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "company_name" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "physical_address" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "custom_opt_out_text" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "ai_provider" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "ai_model" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "ai_api_key_encrypted" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "ai_gateway_url" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "ai_integrations" JSONB;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "brand_color_hex" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "brand_initials" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "branding_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "dedicated_newsletter_sender_id" TEXT;

CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id"           TEXT PRIMARY KEY,
  "user_id"      UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "label"        TEXT NOT NULL,
  "key_prefix"   TEXT NOT NULL,
  "key_hash"     TEXT NOT NULL,
  "scopes"       TEXT[] NOT NULL DEFAULT ARRAY['*']::TEXT[],
  "last_used_at" TIMESTAMP(3),
  "revoked_at"   TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ApiKey_user_id_idx" ON "ApiKey"("user_id");
CREATE INDEX IF NOT EXISTS "ApiKey_key_prefix_idx" ON "ApiKey"("key_prefix");

CREATE TABLE IF NOT EXISTS "Gong" (
  "id"                    TEXT PRIMARY KEY,
  "user_id"               UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name"                  TEXT NOT NULL,
  "slug"                  TEXT NOT NULL,
  "description"           TEXT,
  "cadence"               TEXT NOT NULL DEFAULT 'weekly',
  "template_style"        TEXT NOT NULL DEFAULT 'card',
  "dedicated_sender_id"   TEXT REFERENCES "Sender"("id") ON DELETE SET NULL,
  "knowledge_base_id"     TEXT REFERENCES "KnowledgeBase"("id") ON DELETE SET NULL,
  "welcome_email_enabled" BOOLEAN NOT NULL DEFAULT false,
  "welcome_subject"       TEXT,
  "welcome_body"          TEXT,
  "embed_theme"           TEXT NOT NULL DEFAULT 'minimal',
  "accent_color"          TEXT NOT NULL DEFAULT '#4A2559',
  "headline"              TEXT NOT NULL DEFAULT 'Join our newsletter',
  "subheadline"           TEXT NOT NULL DEFAULT 'Get the latest updates delivered to your inbox.',
  "button_text"           TEXT NOT NULL DEFAULT 'Subscribe',
  "success_message"       TEXT NOT NULL DEFAULT 'Thank you for subscribing!',
  "tags"                  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Gong_user_id_slug_key" ON "Gong"("user_id", "slug");
CREATE INDEX IF NOT EXISTS "Gong_user_id_idx" ON "Gong"("user_id");
CREATE INDEX IF NOT EXISTS "Gong_dedicated_sender_id_idx" ON "Gong"("dedicated_sender_id");
CREATE INDEX IF NOT EXISTS "Gong_knowledge_base_id_idx" ON "Gong"("knowledge_base_id");

CREATE TABLE IF NOT EXISTS "NewsletterRecipient" (
  "id"                TEXT PRIMARY KEY,
  "user_id"           UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "gong_id"           TEXT REFERENCES "Gong"("id") ON DELETE SET NULL,
  "email"             TEXT NOT NULL,
  "name"              TEXT,
  "cadence"           TEXT NOT NULL DEFAULT 'weekly',
  "status"            TEXT NOT NULL DEFAULT 'SUBSCRIBED',
  "source"            TEXT NOT NULL DEFAULT 'ui',
  "tags"              TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata"          JSONB,
  "unsubscribe_token" TEXT UNIQUE,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "NewsletterRecipient_user_id_email_key" ON "NewsletterRecipient"("user_id", "email");
CREATE INDEX IF NOT EXISTS "NewsletterRecipient_user_id_idx" ON "NewsletterRecipient"("user_id");
CREATE INDEX IF NOT EXISTS "NewsletterRecipient_gong_id_idx" ON "NewsletterRecipient"("gong_id");

CREATE TABLE IF NOT EXISTS "NewsletterBroadcast" (
  "id"                TEXT PRIMARY KEY,
  "user_id"           UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "gong_id"           TEXT REFERENCES "Gong"("id") ON DELETE SET NULL,
  "knowledge_base_id" TEXT REFERENCES "KnowledgeBase"("id") ON DELETE SET NULL,
  "subject"           TEXT NOT NULL,
  "body"              TEXT NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'DRAFT',
  "template_style"    TEXT NOT NULL DEFAULT 'card',
  "tag_filter"        TEXT,
  "queued_at"         TIMESTAMP(3),
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "NewsletterBroadcast_user_id_idx" ON "NewsletterBroadcast"("user_id");
CREATE INDEX IF NOT EXISTS "NewsletterBroadcast_gong_id_idx" ON "NewsletterBroadcast"("gong_id");
CREATE INDEX IF NOT EXISTS "NewsletterBroadcast_knowledge_base_id_idx" ON "NewsletterBroadcast"("knowledge_base_id");

CREATE TABLE IF NOT EXISTS "NewsletterQueueItem" (
  "id"           TEXT PRIMARY KEY,
  "broadcast_id" TEXT NOT NULL REFERENCES "NewsletterBroadcast"("id") ON DELETE CASCADE,
  "recipient_id" TEXT NOT NULL,
  "user_id"      UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status"       TEXT NOT NULL DEFAULT 'PENDING',
  "error"        TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "NewsletterQueueItem_status_created_at_idx" ON "NewsletterQueueItem"("status", "created_at");
CREATE INDEX IF NOT EXISTS "NewsletterQueueItem_broadcast_id_idx" ON "NewsletterQueueItem"("broadcast_id");
CREATE INDEX IF NOT EXISTS "NewsletterQueueItem_user_id_idx" ON "NewsletterQueueItem"("user_id");

CREATE TABLE IF NOT EXISTS "Artifact" (
  "id"              TEXT PRIMARY KEY,
  "user_id"         UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "campaign_id"     TEXT REFERENCES "Campaign"("id") ON DELETE SET NULL,
  "gong_id"         TEXT REFERENCES "Gong"("id") ON DELETE SET NULL,
  "broadcast_id"    TEXT REFERENCES "NewsletterBroadcast"("id") ON DELETE SET NULL,
  "title"           TEXT NOT NULL,
  "slug"            TEXT NOT NULL,
  "description"     TEXT,
  "usage_prompt"    TEXT,
  "type"            TEXT NOT NULL DEFAULT 'LINK',
  "attachment_mode" TEXT NOT NULL DEFAULT 'LINK',
  "is_one_time"     BOOLEAN NOT NULL DEFAULT false,
  "url"             TEXT NOT NULL,
  "mime_type"       TEXT,
  "size_bytes"      INTEGER,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Artifact_user_id_slug_key" ON "Artifact"("user_id", "slug");
CREATE INDEX IF NOT EXISTS "Artifact_user_id_idx" ON "Artifact"("user_id");
CREATE INDEX IF NOT EXISTS "Artifact_campaign_id_idx" ON "Artifact"("campaign_id");
CREATE INDEX IF NOT EXISTS "Artifact_gong_id_idx" ON "Artifact"("gong_id");
CREATE INDEX IF NOT EXISTS "Artifact_broadcast_id_idx" ON "Artifact"("broadcast_id");

CREATE TABLE IF NOT EXISTS "Notification" (
  "id"         TEXT PRIMARY KEY,
  "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title"      TEXT NOT NULL,
  "message"    TEXT NOT NULL,
  "type"       TEXT NOT NULL DEFAULT 'INFO',
  "link"       TEXT,
  "is_read"    BOOLEAN NOT NULL DEFAULT false,
  "metadata"   JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Notification_user_id_is_read_idx" ON "Notification"("user_id", "is_read");
CREATE INDEX IF NOT EXISTS "Notification_user_id_created_at_idx" ON "Notification"("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "WebhookSubscription" (
  "id"         TEXT PRIMARY KEY,
  "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "target_url" TEXT NOT NULL,
  "secret"     TEXT NOT NULL,
  "events"     TEXT[] NOT NULL DEFAULT ARRAY['*']::TEXT[],
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WebhookSubscription_user_id_idx" ON "WebhookSubscription"("user_id");

CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
  "id"              TEXT PRIMARY KEY,
  "subscription_id" TEXT NOT NULL REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE,
  "event"           TEXT NOT NULL,
  "payload"         JSONB NOT NULL,
  "status_code"     INTEGER,
  "response_body"   TEXT,
  "error"           TEXT,
  "attempts"        INTEGER NOT NULL DEFAULT 1,
  "status"          TEXT NOT NULL DEFAULT 'DELIVERED',
  "duration_ms"     INTEGER,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WebhookDelivery_subscription_id_created_at_idx" ON "WebhookDelivery"("subscription_id", "created_at");

CREATE TABLE IF NOT EXISTS "CronLock" (
  "name"       TEXT PRIMARY KEY,
  "locked_at"  TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "CronLock" ("name", "locked_at", "updated_at") VALUES
  ('queue', NULL, NOW()),
  ('leads', NULL, NOW()),
  ('followups', NULL, NOW()),
  ('newsletter', NULL, NOW()),
  ('snapshots', NULL, NOW())
ON CONFLICT ("name") DO NOTHING;