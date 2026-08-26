-- CreateTable
CREATE TABLE "RemediationExecutionPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "safetyClass" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rationale" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "executableNow" BOOLEAN NOT NULL DEFAULT false,
    "realExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "verificationPlan" JSONB,
    "rollbackPlan" JSONB,
    "blockers" JSONB,
    "evidence" JSONB,
    "createdById" TEXT,
    "createdByName" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedByName" TEXT,
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemediationExecutionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationApproval" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemediationApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemediationExecutionPlan_organizationId_status_createdAt_idx" ON "RemediationExecutionPlan"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RemediationExecutionPlan_incidentId_createdAt_idx" ON "RemediationExecutionPlan"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "RemediationApproval_organizationId_planId_createdAt_idx" ON "RemediationApproval"("organizationId", "planId", "createdAt");

-- AddForeignKey
ALTER TABLE "RemediationExecutionPlan" ADD CONSTRAINT "RemediationExecutionPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationExecutionPlan" ADD CONSTRAINT "RemediationExecutionPlan_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "InfrastructureIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationApproval" ADD CONSTRAINT "RemediationApproval_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationApproval" ADD CONSTRAINT "RemediationApproval_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RemediationExecutionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
