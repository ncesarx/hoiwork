-- CreateTable
CREATE TABLE "NotificationAutomationConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationAutomationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationAutomationRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "policiesEvaluated" INTEGER NOT NULL DEFAULT 0,
    "incidentsEvaluated" INTEGER NOT NULL DEFAULT 0,
    "alertsCreated" INTEGER NOT NULL DEFAULT 0,
    "escalationsCreated" INTEGER NOT NULL DEFAULT 0,
    "heldMaintenance" INTEGER NOT NULL DEFAULT 0,
    "heldCooldown" INTEGER NOT NULL DEFAULT 0,
    "released" INTEGER NOT NULL DEFAULT 0,
    "deliveriesProcessed" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "simulated" INTEGER NOT NULL DEFAULT 0,
    "retryPending" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationAutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationAutomationConfig_organizationId_key" ON "NotificationAutomationConfig"("organizationId");

-- CreateIndex
CREATE INDEX "NotificationAutomationRun_organizationId_startedAt_idx" ON "NotificationAutomationRun"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "NotificationAutomationRun_organizationId_status_idx" ON "NotificationAutomationRun"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "NotificationAutomationConfig" ADD CONSTRAINT "NotificationAutomationConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationAutomationRun" ADD CONSTRAINT "NotificationAutomationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
