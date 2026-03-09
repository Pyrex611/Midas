-- AlterTable
ALTER TABLE "Draft" ADD COLUMN     "step_number" INTEGER;

-- CreateIndex
CREATE INDEX "Draft_step_number_idx" ON "Draft"("step_number");
