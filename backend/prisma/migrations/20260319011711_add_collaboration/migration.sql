/*
  Warnings:

  - You are about to drop the column `access_token` on the `Mailbox` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `Mailbox` table. All the data in the column will be lost.
  - You are about to drop the column `refresh_token` on the `Mailbox` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CampaignRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- DropIndex
DROP INDEX "Draft_lead_id_idx";

-- DropIndex
DROP INDEX "Draft_step_number_idx";

-- DropIndex
DROP INDEX "Draft_tone_use_case_idx";

-- DropIndex
DROP INDEX "OutboundEmail_mailbox_id_idx";

-- DropIndex
DROP INDEX "OutboundEmail_sent_at_idx";

-- DropIndex
DROP INDEX "OutboundEmail_user_id_idx";

-- DropIndex
DROP INDEX "PendingEmail_mailbox_id_idx";

-- DropIndex
DROP INDEX "PendingEmail_preferred_mailbox_id_idx";

-- DropIndex
DROP INDEX "PendingEmail_user_id_idx";

-- AlterTable
ALTER TABLE "Mailbox" DROP COLUMN "access_token",
DROP COLUMN "provider",
DROP COLUMN "refresh_token";

-- CreateTable
CREATE TABLE "CampaignMember" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "CampaignRole" NOT NULL DEFAULT 'EDITOR',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignInvite" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "sender_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "CampaignRole" NOT NULL DEFAULT 'EDITOR',
    "token" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignMember_user_id_idx" ON "CampaignMember"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMember_campaign_id_user_id_key" ON "CampaignMember"("campaign_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignInvite_token_key" ON "CampaignInvite"("token");

-- CreateIndex
CREATE INDEX "CampaignInvite_email_idx" ON "CampaignInvite"("email");

-- AddForeignKey
ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignInvite" ADD CONSTRAINT "CampaignInvite_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignInvite" ADD CONSTRAINT "CampaignInvite_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
