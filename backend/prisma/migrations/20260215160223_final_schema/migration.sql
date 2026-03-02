/*
  Warnings:

  - You are about to drop the column `reference` on the `Campaign` table. All the data in the column will be lost.

*/
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
INSERT INTO "new_OutboundEmail" ("body", "campaignId", "draftId", "error", "id", "leadId", "openedAt", "repliedAt", "replyText", "sentAt", "status", "subject") SELECT "body", "campaignId", "draftId", "error", "id", "leadId", "openedAt", "repliedAt", "replyText", "sentAt", "status", "subject" FROM "OutboundEmail";
DROP TABLE "OutboundEmail";
ALTER TABLE "new_OutboundEmail" RENAME TO "OutboundEmail";
CREATE INDEX "OutboundEmail_leadId_idx" ON "OutboundEmail"("leadId");
CREATE INDEX "OutboundEmail_campaignId_idx" ON "OutboundEmail"("campaignId");
CREATE INDEX "OutboundEmail_sentAt_idx" ON "OutboundEmail"("sentAt");
CREATE INDEX "OutboundEmail_messageId_idx" ON "OutboundEmail"("messageId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
