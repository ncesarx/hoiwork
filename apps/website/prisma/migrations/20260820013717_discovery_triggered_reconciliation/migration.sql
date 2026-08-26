-- AlterTable
ALTER TABLE "DiscoveryAutomationConfig" ADD COLUMN     "reconciliationEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "IncidentReconciliationRun" ADD COLUMN     "discoveryAutomationRunId" TEXT;

-- CreateIndex
CREATE INDEX "IncidentReconciliationRun_organizationId_discoveryAutomatio_idx" ON "IncidentReconciliationRun"("organizationId", "discoveryAutomationRunId");
