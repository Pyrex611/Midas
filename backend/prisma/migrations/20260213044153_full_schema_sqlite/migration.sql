-- CreateTable
CREATE TABLE "Lead" (
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

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "useCase" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "OutboundEmail" (
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
    CONSTRAINT "OutboundEmail_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutboundEmail_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutboundEmail_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_email_key" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_campaignId_idx" ON "Lead"("campaignId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Draft_isActive_idx" ON "Draft"("isActive");

-- CreateIndex
CREATE INDEX "Draft_tone_useCase_idx" ON "Draft"("tone", "useCase");

-- CreateIndex
CREATE INDEX "OutboundEmail_leadId_idx" ON "OutboundEmail"("leadId");

-- CreateIndex
CREATE INDEX "OutboundEmail_campaignId_idx" ON "OutboundEmail"("campaignId");

-- CreateIndex
CREATE INDEX "OutboundEmail_sentAt_idx" ON "OutboundEmail"("sentAt");
