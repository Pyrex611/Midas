/*
  Warnings:

  - You are about to drop the column `follow_up_delay` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `follow_up_enabled` on the `Campaign` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Campaign_status_idx";

-- DropIndex
DROP INDEX "Campaign_user_id_idx";

-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "follow_up_delay",
DROP COLUMN "follow_up_enabled",
ADD COLUMN     "send_hour_utc" INTEGER NOT NULL DEFAULT 9;

-- CreateTable
CREATE TABLE "FollowUpStep" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL,
    "draft_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FollowUpStep_campaign_id_stepNumber_key" ON "FollowUpStep"("campaign_id", "stepNumber");

-- AddForeignKey
ALTER TABLE "FollowUpStep" ADD CONSTRAINT "FollowUpStep_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpStep" ADD CONSTRAINT "FollowUpStep_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "Draft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
