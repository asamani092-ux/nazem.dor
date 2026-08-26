-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- Seed default rate weights (40/30/30)
INSERT INTO "SystemSetting" ("id", "key", "value", "updatedAt")
VALUES ('sys-rate-weights', 'rate_weights', '{"attendance":40,"completion":30,"homework":30}', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
