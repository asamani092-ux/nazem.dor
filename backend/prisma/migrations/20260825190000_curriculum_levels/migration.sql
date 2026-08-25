-- CreateTable
CREATE TABLE "CurriculumLevel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurriculumLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumLevel_name_key" ON "CurriculumLevel"("name");

-- Seed default levels
INSERT INTO "CurriculumLevel" ("id", "name", "sortOrder") VALUES
  ('cl-temy1', 'تمهيدي 1', 1),
  ('cl-temy2', 'تمهيدي 2', 2),
  ('cl-aww1', 'صفوف أولية 1', 3),
  ('cl-aww2', 'صفوف أولية 2', 4),
  ('cl-aww3', 'صفوف أولية 3', 5)
ON CONFLICT ("name") DO NOTHING;
