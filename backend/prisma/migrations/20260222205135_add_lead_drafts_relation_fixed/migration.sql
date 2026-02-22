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
    "lead_id" TEXT,
    "isReplyDraft" BOOLEAN NOT NULL DEFAULT false,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Draft_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Draft_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Draft" ("body", "campaignId", "createdAt", "id", "isActive", "replyCount", "sentCount", "subject", "tone", "updatedAt", "useCase", "version") SELECT "body", "campaignId", "createdAt", "id", "isActive", "replyCount", "sentCount", "subject", "tone", "updatedAt", "useCase", "version" FROM "Draft";
DROP TABLE "Draft";
ALTER TABLE "new_Draft" RENAME TO "Draft";
CREATE INDEX "Draft_isActive_idx" ON "Draft"("isActive");
CREATE INDEX "Draft_tone_useCase_idx" ON "Draft"("tone", "useCase");
CREATE INDEX "Draft_campaignId_idx" ON "Draft"("campaignId");
CREATE INDEX "Draft_lead_id_idx" ON "Draft"("lead_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
