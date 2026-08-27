-- AlterTable: assign supervisor (MASTER user) to a dar
ALTER TABLE "Dar" ADD COLUMN "supervisorId" TEXT;

-- CreateIndex
CREATE INDEX "Dar_supervisorId_idx" ON "Dar"("supervisorId");

-- AddForeignKey
ALTER TABLE "Dar" ADD CONSTRAINT "Dar_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
