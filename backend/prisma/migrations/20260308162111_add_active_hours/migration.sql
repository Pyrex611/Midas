-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "active_end_hour" INTEGER,
ADD COLUMN     "active_start_hour" INTEGER,
ADD COLUMN     "timezone" TEXT;

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "last_sent_reset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "sendLimit" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "sendPeriod" TEXT NOT NULL DEFAULT 'day',
ADD COLUMN     "sentCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PendingEmail" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "lead_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "draft_id" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "in_reply_to" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "PendingEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingEmail_user_id_status_idx" ON "PendingEmail"("user_id", "status");

-- CreateIndex
CREATE INDEX "PendingEmail_scheduled_at_idx" ON "PendingEmail"("scheduled_at");

-- CreateIndex
CREATE INDEX "Campaign_user_id_idx" ON "Campaign"("user_id");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- AddForeignKey
ALTER TABLE "PendingEmail" ADD CONSTRAINT "PendingEmail_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingEmail" ADD CONSTRAINT "PendingEmail_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingEmail" ADD CONSTRAINT "PendingEmail_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingEmail" ADD CONSTRAINT "PendingEmail_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "Draft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
