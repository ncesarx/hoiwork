-- CreateTable
CREATE TABLE "InfrastructureIncident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL DEFAULT 'HOIWORK',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "severity" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "assetExternalId" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "instanceId" TEXT,
    "instanceName" TEXT,
    "site" TEXT,
    "blastRadius" INTEGER NOT NULL DEFAULT 0,
    "fingerprint" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfrastructureIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InfrastructureIncident_organizationId_status_severity_idx" ON "InfrastructureIncident"("organizationId", "status", "severity");

-- CreateIndex
CREATE INDEX "InfrastructureIncident_organizationId_assetExternalId_idx" ON "InfrastructureIncident"("organizationId", "assetExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "InfrastructureIncident_organizationId_fingerprint_key" ON "InfrastructureIncident"("organizationId", "fingerprint");

-- AddForeignKey
ALTER TABLE "InfrastructureIncident" ADD CONSTRAINT "InfrastructureIncident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
