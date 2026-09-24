-- CreateTable
CREATE TABLE "AutonomousGovernanceAutomationConfigChange" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "previousEnabled" BOOLEAN NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "previousIntervalMinutes" INTEGER NOT NULL,
    "intervalMinutes" INTEGER NOT NULL,
    "previousCommitEnabled" BOOLEAN NOT NULL,
    "commitEnabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutonomousGovernanceAutomationConfigChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AGAutomationConfigChange_org_created_idx" ON "AutonomousGovernanceAutomationConfigChange"("organizationId", "createdAt");
