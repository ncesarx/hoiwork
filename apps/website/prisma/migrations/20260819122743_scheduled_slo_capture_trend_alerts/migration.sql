-- CreateTable
CREATE TABLE "NotificationSloAutomationConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "nocDegradedBelow" INTEGER NOT NULL DEFAULT 90,
    "nocCriticalBelow" INTEGER NOT NULL DEFAULT 70,
    "burnDegradedAt" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "burnCriticalAt" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSloAutomationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSloTrendAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSloTrendAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSloAutomationConfig_organizationId_key" ON "NotificationSloAutomationConfig"("organizationId");

-- CreateIndex
CREATE INDEX "NotificationSloTrendAlert_organizationId_status_severity_idx" ON "NotificationSloTrendAlert"("organizationId", "status", "severity");

-- CreateIndex
CREATE INDEX "NotificationSloTrendAlert_organizationId_lastSeenAt_idx" ON "NotificationSloTrendAlert"("organizationId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSloTrendAlert_organizationId_alertKey_key" ON "NotificationSloTrendAlert"("organizationId", "alertKey");

-- AddForeignKey
ALTER TABLE "NotificationSloAutomationConfig" ADD CONSTRAINT "NotificationSloAutomationConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSloTrendAlert" ADD CONSTRAINT "NotificationSloTrendAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
