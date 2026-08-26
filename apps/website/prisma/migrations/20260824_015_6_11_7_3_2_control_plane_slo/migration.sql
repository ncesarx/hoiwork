CREATE TABLE IF NOT EXISTS "ControlPlaneHealthSnapshot" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "overallState" TEXT NOT NULL,
  "overallScore" INTEGER,
  "confidence" TEXT NOT NULL,
  "discoveryState" TEXT NOT NULL,
  "proxmoxState" TEXT NOT NULL,
  "reconciliationState" TEXT NOT NULL,
  "incidentAutomationState" TEXT NOT NULL,
  "notificationsState" TEXT NOT NULL,
  "sloState" TEXT NOT NULL,
  "rootCauseCount" INTEGER NOT NULL DEFAULT 0,
  "blockedCapabilityCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  CONSTRAINT "ControlPlaneHealthSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ControlPlaneHealthSnapshot_organizationId_capturedAt_idx"
ON "ControlPlaneHealthSnapshot"("organizationId","capturedAt");

CREATE INDEX IF NOT EXISTS "ControlPlaneHealthSnapshot_organizationId_overallState_idx"
ON "ControlPlaneHealthSnapshot"("organizationId","overallState");

CREATE TABLE IF NOT EXISTS "ControlPlaneSloPolicy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "availabilityTarget" DOUBLE PRECISION NOT NULL DEFAULT 99.5,
  "degradedWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "criticalWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "snapshotIntervalMinutes" INTEGER NOT NULL DEFAULT 5,
  "retentionDays" INTEGER NOT NULL DEFAULT 90,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ControlPlaneSloPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ControlPlaneSloPolicy_organizationId_key"
ON "ControlPlaneSloPolicy"("organizationId");
