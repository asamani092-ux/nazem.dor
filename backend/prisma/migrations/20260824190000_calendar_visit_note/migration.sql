-- AlterTable
ALTER TABLE "Alert" ADD COLUMN "scheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Alert_darId_scheduledAt_idx" ON "Alert"("darId", "scheduledAt");

-- AlterTable
ALTER TABLE "ExamGrade" ADD COLUMN "note" TEXT;
