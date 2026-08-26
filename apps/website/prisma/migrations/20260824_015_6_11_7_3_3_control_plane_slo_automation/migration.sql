ALTER TABLE "ControlPlaneSloPolicy"
  ADD COLUMN IF NOT EXISTS "lastRunAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSuccessAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastFailureAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastError" TEXT,
  ADD COLUMN IF NOT EXISTS "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS "ControlPlaneSloAutomationRun" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "snapshotId" TEXT,
  "availability" DOUBLE PRECISION,
  "errorBudgetPercent" DOUBLE PRECISION,
  "burnRate" DOUBLE PRECISION,
  "burnState" TEXT,
  "errorMessage" TEXT,
  "metadata" JSONB,
  CONSTRAINT "ControlPlaneSloAutomationRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ControlPlaneSloAutomationRun_organizationId_startedAt_idx" ON "ControlPlaneSloAutomationRun"("organizationId","startedAt");
CREATE INDEX IF NOT EXISTS "ControlPlaneSloAutomationRun_organizationId_status_idx" ON "ControlPlaneSloAutomationRun"("organizationId","status");
