-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "position" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "outreach_status" TEXT,
    "campaign_id" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "context" TEXT,
    "reference" TEXT,
    "sender_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "follow_up_enabled" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_delay" INTEGER NOT NULL DEFAULT 24,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "use_case" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "campaign_id" TEXT,
    "lead_id" TEXT,
    "is_reply_draft" BOOLEAN NOT NULL DEFAULT false,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "reply_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundEmail" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "lead_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "draft_id" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "error" TEXT,
    "opened_at" TIMESTAMP(3),
    "replied_at" TIMESTAMP(3),
    "reply_text" TEXT,
    "reply_to_id" TEXT,
    "is_incoming" BOOLEAN NOT NULL DEFAULT false,
    "message_id" TEXT,
    "references" TEXT,
    "in_reply_to" TEXT,
    "from_address" TEXT,
    "to_address" TEXT,
    "sentiment" TEXT,
    "intent" TEXT,
    "analysis" TEXT,

    CONSTRAINT "OutboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_campaign_id_idx" ON "Lead"("campaign_id");

-- CreateIndex
CREATE INDEX "Lead_user_id_idx" ON "Lead"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_user_id_email_key" ON "Lead"("user_id", "email");

-- CreateIndex
CREATE INDEX "Campaign_user_id_idx" ON "Campaign"("user_id");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Draft_is_active_idx" ON "Draft"("is_active");

-- CreateIndex
CREATE INDEX "Draft_tone_use_case_idx" ON "Draft"("tone", "use_case");

-- CreateIndex
CREATE INDEX "Draft_campaign_id_idx" ON "Draft"("campaign_id");

-- CreateIndex
CREATE INDEX "Draft_lead_id_idx" ON "Draft"("lead_id");

-- CreateIndex
CREATE INDEX "Draft_user_id_idx" ON "Draft"("user_id");

-- CreateIndex
CREATE INDEX "OutboundEmail_lead_id_idx" ON "OutboundEmail"("lead_id");

-- CreateIndex
CREATE INDEX "OutboundEmail_campaign_id_idx" ON "OutboundEmail"("campaign_id");

-- CreateIndex
CREATE INDEX "OutboundEmail_sent_at_idx" ON "OutboundEmail"("sent_at");

-- CreateIndex
CREATE INDEX "OutboundEmail_message_id_idx" ON "OutboundEmail"("message_id");

-- CreateIndex
CREATE INDEX "OutboundEmail_user_id_idx" ON "OutboundEmail"("user_id");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "Draft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "OutboundEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;
