-- CreateEnum
CREATE TYPE "AcademicTermStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "AcademicTerm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AcademicTermStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcademicTerm_status_idx" ON "AcademicTerm"("status");

-- Seed default active term for backfill
INSERT INTO "AcademicTerm" ("id", "name", "status", "startsAt", "createdAt")
VALUES ('cm0defaultterm000000000001', 'الفصل الحالي', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Add nullable termId columns
ALTER TABLE "DailyTracking" ADD COLUMN "termId" TEXT;
ALTER TABLE "LessonTracked" ADD COLUMN "termId" TEXT;
ALTER TABLE "WeekAttachment" ADD COLUMN "termId" TEXT;
ALTER TABLE "Exam" ADD COLUMN "termId" TEXT;
ALTER TABLE "ExamGrade" ADD COLUMN "termId" TEXT;

-- Backfill existing rows
UPDATE "DailyTracking" SET "termId" = 'cm0defaultterm000000000001' WHERE "termId" IS NULL;
UPDATE "LessonTracked" SET "termId" = 'cm0defaultterm000000000001' WHERE "termId" IS NULL;
UPDATE "WeekAttachment" SET "termId" = 'cm0defaultterm000000000001' WHERE "termId" IS NULL;
UPDATE "Exam" SET "termId" = 'cm0defaultterm000000000001' WHERE "termId" IS NULL;
UPDATE "ExamGrade" SET "termId" = 'cm0defaultterm000000000001' WHERE "termId" IS NULL;

-- Make termId required
ALTER TABLE "DailyTracking" ALTER COLUMN "termId" SET NOT NULL;
ALTER TABLE "LessonTracked" ALTER COLUMN "termId" SET NOT NULL;
ALTER TABLE "WeekAttachment" ALTER COLUMN "termId" SET NOT NULL;
ALTER TABLE "Exam" ALTER COLUMN "termId" SET NOT NULL;
ALTER TABLE "ExamGrade" ALTER COLUMN "termId" SET NOT NULL;

-- Drop old unique constraints
DROP INDEX IF EXISTS "DailyTracking_classId_studentId_week_day_key";
DROP INDEX IF EXISTS "LessonTracked_classId_week_day_key";
DROP INDEX IF EXISTS "WeekAttachment_classId_week_key";

-- Create new unique constraints including termId
CREATE UNIQUE INDEX "DailyTracking_termId_classId_studentId_week_day_key" ON "DailyTracking"("termId", "classId", "studentId", "week", "day");
CREATE UNIQUE INDEX "LessonTracked_termId_classId_week_day_key" ON "LessonTracked"("termId", "classId", "week", "day");
CREATE UNIQUE INDEX "WeekAttachment_termId_classId_week_key" ON "WeekAttachment"("termId", "classId", "week");

-- Create indexes on termId
CREATE INDEX "DailyTracking_termId_idx" ON "DailyTracking"("termId");
CREATE INDEX "LessonTracked_termId_idx" ON "LessonTracked"("termId");
CREATE INDEX "WeekAttachment_termId_idx" ON "WeekAttachment"("termId");
CREATE INDEX "Exam_termId_idx" ON "Exam"("termId");
CREATE INDEX "ExamGrade_termId_idx" ON "ExamGrade"("termId");

-- AddForeignKey
ALTER TABLE "DailyTracking" ADD CONSTRAINT "DailyTracking_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonTracked" ADD CONSTRAINT "LessonTracked_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WeekAttachment" ADD CONSTRAINT "WeekAttachment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamGrade" ADD CONSTRAINT "ExamGrade_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
