-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "is_satisfied" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "PendingEmail_scheduled_at_idx" ON "PendingEmail"("scheduled_at");
