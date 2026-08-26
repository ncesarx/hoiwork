-- CreateTable
CREATE TABLE "IncidentReconciliationRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "inspected" INTEGER NOT NULL DEFAULT 0,
    "keptOpen" INTEGER NOT NULL DEFAULT 0,
    "resolved" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "details" JSONB,

    CONSTRAINT "IncidentReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncidentReconciliationRun_organizationId_startedAt_idx" ON "IncidentReconciliationRun"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "IncidentReconciliationRun_organizationId_status_idx" ON "IncidentReconciliationRun"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "IncidentReconciliationRun" ADD CONSTRAINT "IncidentReconciliationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
