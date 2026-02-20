-- DropIndex
DROP INDEX "Campaign_status_idx";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "leadId" TEXT,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Draft_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Draft_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Draft" ("body", "campaignId", "createdAt", "id", "isActive", "replyCount", "sentCount", "subject", "tone", "updatedAt", "useCase", "version") SELECT "body", "campaignId", "createdAt", "id", "isActive", "replyCount", "sentCount", "subject", "tone", "updatedAt", "useCase", "version" FROM "Draft";
DROP TABLE "Draft";
ALTER TABLE "new_Draft" RENAME TO "Draft";
CREATE INDEX "Draft_isActive_idx" ON "Draft"("isActive");
CREATE INDEX "Draft_tone_useCase_idx" ON "Draft"("tone", "useCase");
CREATE INDEX "Draft_campaignId_idx" ON "Draft"("campaignId");
CREATE INDEX "Draft_leadId_idx" ON "Draft"("leadId");
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
    "replyDraftId" TEXT,
    CONSTRAINT "OutboundEmail_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutboundEmail_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutboundEmail_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutboundEmail_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "OutboundEmail" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutboundEmail_replyDraftId_fkey" FOREIGN KEY ("replyDraftId") REFERENCES "Draft" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OutboundEmail" ("body", "campaignId", "draftId", "error", "fromAddress", "id", "inReplyTo", "intent", "isIncoming", "leadId", "messageId", "openedAt", "references", "repliedAt", "replyText", "reply_to_id", "sentAt", "sentiment", "status", "subject", "toAddress") SELECT "body", "campaignId", "draftId", "error", "fromAddress", "id", "inReplyTo", "intent", "isIncoming", "leadId", "messageId", "openedAt", "references", "repliedAt", "replyText", "reply_to_id", "sentAt", "sentiment", "status", "subject", "toAddress" FROM "OutboundEmail";
DROP TABLE "OutboundEmail";
ALTER TABLE "new_OutboundEmail" RENAME TO "OutboundEmail";
CREATE UNIQUE INDEX "OutboundEmail_replyDraftId_key" ON "OutboundEmail"("replyDraftId");
CREATE INDEX "OutboundEmail_leadId_idx" ON "OutboundEmail"("leadId");
CREATE INDEX "OutboundEmail_campaignId_idx" ON "OutboundEmail"("campaignId");
CREATE INDEX "OutboundEmail_sentAt_idx" ON "OutboundEmail"("sentAt");
CREATE INDEX "OutboundEmail_messageId_idx" ON "OutboundEmail"("messageId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
