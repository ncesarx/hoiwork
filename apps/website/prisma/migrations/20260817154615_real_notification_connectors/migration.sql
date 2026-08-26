-- CreateTable
CREATE TABLE "NotificationConnector" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'SIMULATED',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "secretRef" TEXT,
    "config" JSONB,
    "lastTestAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationConnector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationConnector_organizationId_enabled_type_idx" ON "NotificationConnector"("organizationId", "enabled", "type");

-- AddForeignKey
ALTER TABLE "NotificationConnector" ADD CONSTRAINT "NotificationConnector_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
