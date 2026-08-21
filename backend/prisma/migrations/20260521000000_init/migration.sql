-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_MASTER', 'MASTER', 'MANAGER', 'TEACHER');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "CurriculumType" AS ENUM ('TIBYAN', 'QARI', 'BOTH');

-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('NOTICE', 'VISIT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "darId" TEXT,
    "classId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dar" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "curriculum" "CurriculumType" NOT NULL,
    "managerName" TEXT NOT NULL,
    "managerPhone" TEXT NOT NULL,
    "location" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "darId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "teacherPhone" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "darId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentPhone" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumPlan" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "educational" TEXT NOT NULL,
    "homework" TEXT NOT NULL,
    "tarbawi" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "CurriculumPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "kind" "AlertKind" NOT NULL DEFAULT 'NOTICE',
    "darId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRead" (
    "id" TEXT NOT NULL,
    "darId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "darId" TEXT,
    "examDate" TIMESTAMP(3) NOT NULL,
    "link" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherNotification" (
    "id" TEXT NOT NULL,
    "darId" TEXT NOT NULL,
    "classId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTracking" (
    "id" TEXT NOT NULL,
    "darId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "dateStr" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "attendance" TEXT NOT NULL,
    "homework" TEXT NOT NULL,
    "educational" TEXT NOT NULL,
    "tarbawi" TEXT NOT NULL DEFAULT '-',
    "attachment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonTracked" (
    "id" TEXT NOT NULL,
    "darId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "day" TEXT NOT NULL,

    CONSTRAINT "LessonTracked_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamGrade" (
    "id" TEXT NOT NULL,
    "darId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "examTitle" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "score" TEXT NOT NULL,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamGrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "User_darId_idx" ON "User"("darId");

-- CreateIndex
CREATE INDEX "Dar_status_idx" ON "Dar"("status");

-- CreateIndex
CREATE INDEX "Dar_name_idx" ON "Dar"("name");

-- CreateIndex
CREATE INDEX "Class_darId_status_idx" ON "Class"("darId", "status");

-- CreateIndex
CREATE INDEX "Class_teacherPhone_idx" ON "Class"("teacherPhone");

-- CreateIndex
CREATE INDEX "Student_darId_classId_status_idx" ON "Student"("darId", "classId", "status");

-- CreateIndex
CREATE INDEX "Student_classId_status_idx" ON "Student"("classId", "status");

-- CreateIndex
CREATE INDEX "CurriculumPlan_level_week_idx" ON "CurriculumPlan"("level", "week");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumPlan_level_week_day_key" ON "CurriculumPlan"("level", "week", "day");

-- CreateIndex
CREATE INDEX "Alert_darId_createdAt_idx" ON "Alert"("darId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertRead_darId_idx" ON "AlertRead"("darId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertRead_darId_alertId_key" ON "AlertRead"("darId", "alertId");

-- CreateIndex
CREATE INDEX "Exam_darId_examDate_idx" ON "Exam"("darId", "examDate");

-- CreateIndex
CREATE INDEX "TeacherNotification_darId_classId_createdAt_idx" ON "TeacherNotification"("darId", "classId", "createdAt");

-- CreateIndex
CREATE INDEX "DailyTracking_darId_classId_week_idx" ON "DailyTracking"("darId", "classId", "week");

-- CreateIndex
CREATE INDEX "DailyTracking_studentId_idx" ON "DailyTracking"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTracking_classId_studentId_week_day_key" ON "DailyTracking"("classId", "studentId", "week", "day");

-- CreateIndex
CREATE INDEX "LessonTracked_darId_classId_week_idx" ON "LessonTracked"("darId", "classId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "LessonTracked_classId_week_day_key" ON "LessonTracked"("classId", "week", "day");

-- CreateIndex
CREATE INDEX "ExamGrade_classId_examId_idx" ON "ExamGrade"("classId", "examId");

-- CreateIndex
CREATE INDEX "ExamGrade_studentId_idx" ON "ExamGrade"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamGrade_classId_examId_studentId_key" ON "ExamGrade"("classId", "examId", "studentId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_darId_fkey" FOREIGN KEY ("darId") REFERENCES "Dar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_darId_fkey" FOREIGN KEY ("darId") REFERENCES "Dar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_darId_fkey" FOREIGN KEY ("darId") REFERENCES "Dar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_darId_fkey" FOREIGN KEY ("darId") REFERENCES "Dar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRead" ADD CONSTRAINT "AlertRead_darId_fkey" FOREIGN KEY ("darId") REFERENCES "Dar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_darId_fkey" FOREIGN KEY ("darId") REFERENCES "Dar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherNotification" ADD CONSTRAINT "TeacherNotification_darId_fkey" FOREIGN KEY ("darId") REFERENCES "Dar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherNotification" ADD CONSTRAINT "TeacherNotification_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTracking" ADD CONSTRAINT "DailyTracking_darId_fkey" FOREIGN KEY ("darId") REFERENCES "Dar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTracking" ADD CONSTRAINT "DailyTracking_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTracking" ADD CONSTRAINT "DailyTracking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTracked" ADD CONSTRAINT "LessonTracked_darId_fkey" FOREIGN KEY ("darId") REFERENCES "Dar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTracked" ADD CONSTRAINT "LessonTracked_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamGrade" ADD CONSTRAINT "ExamGrade_darId_fkey" FOREIGN KEY ("darId") REFERENCES "Dar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamGrade" ADD CONSTRAINT "ExamGrade_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamGrade" ADD CONSTRAINT "ExamGrade_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamGrade" ADD CONSTRAINT "ExamGrade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
