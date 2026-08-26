-- CreateTable
CREATE TABLE "RemediationExecutionRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'SIMULATED',
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "executor" TEXT NOT NULL,
    "request" JSONB,
    "preconditions" JSONB,
    "result" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemediationExecutionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemediationExecutionRun_organizationId_status_startedAt_idx" ON "RemediationExecutionRun"("organizationId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "RemediationExecutionRun_incidentId_startedAt_idx" ON "RemediationExecutionRun"("incidentId", "startedAt");

-- CreateIndex
CREATE INDEX "RemediationExecutionRun_planId_startedAt_idx" ON "RemediationExecutionRun"("planId", "startedAt");

-- AddForeignKey
ALTER TABLE "RemediationExecutionRun" ADD CONSTRAINT "RemediationExecutionRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationExecutionRun" ADD CONSTRAINT "RemediationExecutionRun_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "InfrastructureIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationExecutionRun" ADD CONSTRAINT "RemediationExecutionRun_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RemediationExecutionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
