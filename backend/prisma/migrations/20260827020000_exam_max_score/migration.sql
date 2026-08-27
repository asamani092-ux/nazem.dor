-- AlterTable: add maxScore to Exam
ALTER TABLE "Exam" ADD COLUMN "maxScore" INTEGER NOT NULL DEFAULT 100;
