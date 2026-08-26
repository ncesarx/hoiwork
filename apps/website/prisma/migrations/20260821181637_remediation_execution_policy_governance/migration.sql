-- CreateTable
CREATE TABLE "RemediationGovernanceEvaluation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL DEFAULT '015.6.11.6.1',
    "eligibleForRealExecution" BOOLEAN NOT NULL DEFAULT false,
    "realExecutionStillBlocked" BOOLEAN NOT NULL DEFAULT true,
    "checks" JSONB,
    "blockers" JSONB,
    "warnings" JSONB,
    "targetAssessment" JSONB,
    "approvalAssessment" JSONB,
    "maintenanceAssessment" JSONB,
    "concurrencyAssessment" JSONB,
    "circuitBreakerAssessment" JSONB,
    "killSwitchAssessment" JSONB,
    "evaluatedById" TEXT,
    "evaluatedByName" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemediationGovernanceEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemediationGovernanceEvaluation_organizationId_decision_eva_idx" ON "RemediationGovernanceEvaluation"("organizationId", "decision", "evaluatedAt");

-- CreateIndex
CREATE INDEX "RemediationGovernanceEvaluation_incidentId_evaluatedAt_idx" ON "RemediationGovernanceEvaluation"("incidentId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "RemediationGovernanceEvaluation_planId_evaluatedAt_idx" ON "RemediationGovernanceEvaluation"("planId", "evaluatedAt");

-- AddForeignKey
ALTER TABLE "RemediationGovernanceEvaluation" ADD CONSTRAINT "RemediationGovernanceEvaluation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationGovernanceEvaluation" ADD CONSTRAINT "RemediationGovernanceEvaluation_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "InfrastructureIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationGovernanceEvaluation" ADD CONSTRAINT "RemediationGovernanceEvaluation_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RemediationExecutionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
