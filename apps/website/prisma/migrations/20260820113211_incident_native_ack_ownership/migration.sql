-- AlterTable
ALTER TABLE "InfrastructureIncident" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "acknowledgedById" TEXT,
ADD COLUMN     "acknowledgedByName" TEXT,
ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "assignedToName" TEXT;

-- CreateIndex
CREATE INDEX "InfrastructureIncident_organizationId_assignedToId_status_idx" ON "InfrastructureIncident"("organizationId", "assignedToId", "status");

-- CreateIndex
CREATE INDEX "InfrastructureIncident_organizationId_acknowledgedAt_idx" ON "InfrastructureIncident"("organizationId", "acknowledgedAt");
