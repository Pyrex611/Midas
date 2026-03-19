-- DropIndex
DROP INDEX "CampaignInvite_email_idx";

-- DropIndex
DROP INDEX "CampaignMember_user_id_idx";

-- DropIndex
DROP INDEX "Draft_campaign_id_idx";

-- DropIndex
DROP INDEX "Draft_user_id_idx";

-- DropIndex
DROP INDEX "Lead_campaign_id_idx";

-- DropIndex
DROP INDEX "Lead_status_idx";

-- DropIndex
DROP INDEX "Lead_user_id_idx";

-- AlterTable
ALTER TABLE "Mailbox" ADD COLUMN     "bounce_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "reply_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'HEALTHY',
ADD COLUMN     "total_sent" INTEGER NOT NULL DEFAULT 0;
