-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "resumeText" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "secondaryEmail" TEXT;

-- CreateTable
CREATE TABLE "FollowUpSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "sentAt" DATETIME,
    "draftId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "FollowUpSchedule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FollowUpSchedule_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FollowUpSchedule_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FollowUpSchedule_campaignId_idx" ON "FollowUpSchedule"("campaignId");

-- CreateIndex
CREATE INDEX "FollowUpSchedule_leadId_idx" ON "FollowUpSchedule"("leadId");
