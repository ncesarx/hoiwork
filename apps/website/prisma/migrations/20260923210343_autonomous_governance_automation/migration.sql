-- CreateTable
CREATE TABLE "AutonomousGovernanceAutomationConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "commitEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutonomousGovernanceAutomationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutonomousGovernanceAutomationRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "capabilities" INTEGER NOT NULL DEFAULT 0,
    "changed" INTEGER NOT NULL DEFAULT 0,
    "authorized" INTEGER NOT NULL DEFAULT 0,
    "restricted" INTEGER NOT NULL DEFAULT 0,
    "blocked" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutonomousGovernanceAutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutonomousGovernanceAutomationConfig_organizationId_key" ON "AutonomousGovernanceAutomationConfig"("organizationId");

-- CreateIndex
CREATE INDEX "AutonomousGovernanceAutomationConfig_enabled_idx" ON "AutonomousGovernanceAutomationConfig"("enabled");

-- CreateIndex
CREATE INDEX "AutonomousGovernanceAutomationRun_organizationId_startedAt_idx" ON "AutonomousGovernanceAutomationRun"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "AutonomousGovernanceAutomationRun_organizationId_status_idx" ON "AutonomousGovernanceAutomationRun"("organizationId", "status");
