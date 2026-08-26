CREATE TABLE IF NOT EXISTS "AutonomousCapabilityGovernanceState" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "candidateDecision" TEXT NOT NULL,
  "effectiveDecision" TEXT NOT NULL,
  "consecutiveAuthorized" INTEGER NOT NULL DEFAULT 0,
  "consecutiveRestricted" INTEGER NOT NULL DEFAULT 0,
  "consecutiveBlocked" INTEGER NOT NULL DEFAULT 0,
  "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastCandidateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastTransitionAt" TIMESTAMP(3),
  "recoveredAt" TIMESTAMP(3),
  "reasons" JSONB,
  "evidence" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutonomousCapabilityGovernanceState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AutonomousCapabilityGovernanceState_organizationId_capability_key"
ON "AutonomousCapabilityGovernanceState"("organizationId","capability");

CREATE INDEX IF NOT EXISTS "AutonomousCapabilityGovernanceState_organizationId_effectiveDecision_idx"
ON "AutonomousCapabilityGovernanceState"("organizationId","effectiveDecision");

CREATE INDEX IF NOT EXISTS "AutonomousCapabilityGovernanceState_organizationId_lastEvaluatedAt_idx"
ON "AutonomousCapabilityGovernanceState"("organizationId","lastEvaluatedAt");

CREATE TABLE IF NOT EXISTS "AutonomousGovernanceAudit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "candidateDecision" TEXT NOT NULL,
  "previousDecision" TEXT,
  "effectiveDecision" TEXT NOT NULL,
  "changed" BOOLEAN NOT NULL DEFAULT false,
  "reasons" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutonomousGovernanceAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AutonomousGovernanceAudit_organizationId_createdAt_idx"
ON "AutonomousGovernanceAudit"("organizationId","createdAt");

CREATE INDEX IF NOT EXISTS "AutonomousGovernanceAudit_organizationId_capability_createdAt_idx"
ON "AutonomousGovernanceAudit"("organizationId","capability","createdAt");

CREATE INDEX IF NOT EXISTS "AutonomousGovernanceAudit_organizationId_eventType_idx"
ON "AutonomousGovernanceAudit"("organizationId","eventType");
