-- CreateTable
CREATE TABLE "RemediationVerificationRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "executionRunId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'SIMULATED',
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "verificationState" TEXT NOT NULL DEFAULT 'PENDING',
    "rollbackReadiness" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "expectedState" TEXT,
    "observedState" TEXT,
    "evidence" JSONB,
    "checks" JSONB,
    "rollbackAssessment" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemediationVerificationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemediationVerificationRun_organizationId_status_startedAt_idx" ON "RemediationVerificationRun"("organizationId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "RemediationVerificationRun_incidentId_startedAt_idx" ON "RemediationVerificationRun"("incidentId", "startedAt");

-- CreateIndex
CREATE INDEX "RemediationVerificationRun_planId_startedAt_idx" ON "RemediationVerificationRun"("planId", "startedAt");

-- CreateIndex
CREATE INDEX "RemediationVerificationRun_executionRunId_idx" ON "RemediationVerificationRun"("executionRunId");

-- AddForeignKey
ALTER TABLE "RemediationVerificationRun" ADD CONSTRAINT "RemediationVerificationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationVerificationRun" ADD CONSTRAINT "RemediationVerificationRun_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "InfrastructureIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationVerificationRun" ADD CONSTRAINT "RemediationVerificationRun_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RemediationExecutionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationVerificationRun" ADD CONSTRAINT "RemediationVerificationRun_executionRunId_fkey" FOREIGN KEY ("executionRunId") REFERENCES "RemediationExecutionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
