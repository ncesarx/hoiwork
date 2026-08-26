-- CreateTable
CREATE TABLE "RemediationExecutionAuthorization" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "governanceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AUTHORIZED',
    "tokenHash" TEXT NOT NULL,
    "bindingFingerprint" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "assetExternalId" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "nodeName" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokedByName" TEXT,
    "revokeReason" TEXT,
    "issuedById" TEXT,
    "issuedByName" TEXT,
    "preflight" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemediationExecutionAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RemediationExecutionAuthorization_tokenHash_key" ON "RemediationExecutionAuthorization"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RemediationExecutionAuthorization_bindingFingerprint_key" ON "RemediationExecutionAuthorization"("bindingFingerprint");

-- CreateIndex
CREATE INDEX "RemediationExecutionAuthorization_organizationId_status_exp_idx" ON "RemediationExecutionAuthorization"("organizationId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "RemediationExecutionAuthorization_incidentId_issuedAt_idx" ON "RemediationExecutionAuthorization"("incidentId", "issuedAt");

-- CreateIndex
CREATE INDEX "RemediationExecutionAuthorization_planId_issuedAt_idx" ON "RemediationExecutionAuthorization"("planId", "issuedAt");

-- AddForeignKey
ALTER TABLE "RemediationExecutionAuthorization" ADD CONSTRAINT "RemediationExecutionAuthorization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationExecutionAuthorization" ADD CONSTRAINT "RemediationExecutionAuthorization_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "InfrastructureIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationExecutionAuthorization" ADD CONSTRAINT "RemediationExecutionAuthorization_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RemediationExecutionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationExecutionAuthorization" ADD CONSTRAINT "RemediationExecutionAuthorization_governanceId_fkey" FOREIGN KEY ("governanceId") REFERENCES "RemediationGovernanceEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
