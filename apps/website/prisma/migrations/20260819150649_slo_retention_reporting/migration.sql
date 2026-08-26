-- CreateTable
CREATE TABLE "NotificationSloRetentionConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastCleanupAt" TIMESTAMP(3),
    "lastDeletedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSloRetentionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSloRetentionConfig_organizationId_key" ON "NotificationSloRetentionConfig"("organizationId");

-- AddForeignKey
ALTER TABLE "NotificationSloRetentionConfig" ADD CONSTRAINT "NotificationSloRetentionConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
