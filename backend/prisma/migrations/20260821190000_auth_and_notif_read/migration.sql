-- AlterTable
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "TeacherNotificationRead" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherNotificationRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherNotificationRead_userId_idx" ON "TeacherNotificationRead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherNotificationRead_notificationId_userId_key" ON "TeacherNotificationRead"("notificationId", "userId");

-- AddForeignKey
ALTER TABLE "TeacherNotificationRead" ADD CONSTRAINT "TeacherNotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "TeacherNotification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed admin should not be forced if already exists: leave default; seed will set false
