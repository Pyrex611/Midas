-- DropForeignKey
ALTER TABLE "FollowUpStep" DROP CONSTRAINT "FollowUpStep_campaign_id_fkey";

-- DropIndex
DROP INDEX "Mailbox_email_idx";

-- DropIndex
DROP INDEX "OutboundEmail_campaign_id_idx";

-- DropIndex
DROP INDEX "OutboundEmail_message_id_idx";

-- DropIndex
DROP INDEX "PendingEmail_scheduled_at_idx";

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "extendedObjective" TEXT,
ADD COLUMN     "objective" TEXT,
ADD COLUMN     "targetTool" TEXT;

-- AlterTable
ALTER TABLE "FollowUpStep" ADD COLUMN     "microObjective" TEXT;

-- AddForeignKey
ALTER TABLE "FollowUpStep" ADD CONSTRAINT "FollowUpStep_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
