-- CreateTable
CREATE TABLE "WeekAttachment" (
    "id" TEXT NOT NULL,
    "darId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeekAttachment_darId_week_idx" ON "WeekAttachment"("darId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "WeekAttachment_classId_week_key" ON "WeekAttachment"("classId", "week");

-- AddForeignKey
ALTER TABLE "WeekAttachment" ADD CONSTRAINT "WeekAttachment_darId_fkey" FOREIGN KEY ("darId") REFERENCES "Dar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekAttachment" ADD CONSTRAINT "WeekAttachment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
