/*
  Warnings:

  - You are about to drop the `FollowUpSchedule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `reference` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `resumeText` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `senderName` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `leadId` on the `Draft` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryEmail` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `replyDraftId` on the `OutboundEmail` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "FollowUpSchedule_leadId_idx";

-- DropIndex
DROP INDEX "FollowUpSchedule_campaignId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "FollowUpSchedule";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "context" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME
);
INSERT INTO "new_Campaign" ("completedAt", "context", "createdAt", "description", "id", "name", "startedAt", "status") SELECT "completedAt", "context", "createdAt", "description", "id", "name", "startedAt", "status" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");
CREATE TABLE "new_Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "useCase" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "campaignId" TEXT,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Draft_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Draft" ("body", "campaignId", "createdAt", "id", "isActive", "replyCount", "sentCount", "subject", "tone", "updatedAt", "useCase", "version") SELECT "body", "campaignId", "createdAt", "id", "isActive", "replyCount", "sentCount", "subject", "tone", "updatedAt", "useCase", "version" FROM "Draft";
DROP TABLE "Draft";
ALTER TABLE "new_Draft" RENAME TO "Draft";
CREATE INDEX "Draft_isActive_idx" ON "Draft"("isActive");
CREATE INDEX "Draft_tone_useCase_idx" ON "Draft"("tone", "useCase");
CREATE INDEX "Draft_campaignId_idx" ON "Draft"("campaignId");
CREATE TABLE "new_Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "position" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "outreachStatus" TEXT,
    "campaignId" TEXT,
    CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("campaignId", "company", "createdAt", "email", "id", "name", "outreachStatus", "position", "status", "updatedAt") SELECT "campaignId", "company", "createdAt", "email", "id", "name", "outreachStatus", "position", "status", "updatedAt" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE UNIQUE INDEX "Lead_email_key" ON "Lead"("email");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_email_idx" ON "Lead"("email");
CREATE INDEX "Lead_campaignId_idx" ON "Lead"("campaignId");
CREATE TABLE "new_OutboundEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "campaignId" TEXT,
    "draftId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "error" TEXT,
    "openedAt" DATETIME,
    "repliedAt" DATETIME,
    "replyText" TEXT,
    "reply_to_id" TEXT,
    "isIncoming" BOOLEAN NOT NULL DEFAULT false,
    "messageId" TEXT,
    "references" TEXT,
    "inReplyTo" TEXT,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "sentiment" TEXT,
    "intent" TEXT,
    CONSTRAINT "OutboundEmail_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutboundEmail_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutboundEmail_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutboundEmail_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "OutboundEmail" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OutboundEmail" ("body", "campaignId", "draftId", "error", "fromAddress", "id", "inReplyTo", "intent", "isIncoming", "leadId", "messageId", "openedAt", "references", "repliedAt", "replyText", "reply_to_id", "sentAt", "sentiment", "status", "subject", "toAddress") SELECT "body", "campaignId", "draftId", "error", "fromAddress", "id", "inReplyTo", "intent", "isIncoming", "leadId", "messageId", "openedAt", "references", "repliedAt", "replyText", "reply_to_id", "sentAt", "sentiment", "status", "subject", "toAddress" FROM "OutboundEmail";
DROP TABLE "OutboundEmail";
ALTER TABLE "new_OutboundEmail" RENAME TO "OutboundEmail";
CREATE INDEX "OutboundEmail_leadId_idx" ON "OutboundEmail"("leadId");
CREATE INDEX "OutboundEmail_campaignId_idx" ON "OutboundEmail"("campaignId");
CREATE INDEX "OutboundEmail_sentAt_idx" ON "OutboundEmail"("sentAt");
CREATE INDEX "OutboundEmail_messageId_idx" ON "OutboundEmail"("messageId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
