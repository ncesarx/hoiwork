-- CreateTable
CREATE TABLE "IncidentSlaEvaluationRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "inspected" INTEGER NOT NULL DEFAULT 0,
    "ackBreaches" INTEGER NOT NULL DEFAULT 0,
    "resolveBreaches" INTEGER NOT NULL DEFAULT 0,
    "escalationsCreated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "details" JSONB,

    CONSTRAINT "IncidentSlaEvaluationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentSlaEscalation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "breachType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "fingerprint" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clearedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "IncidentSlaEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncidentSlaEvaluationRun_organizationId_startedAt_idx" ON "IncidentSlaEvaluationRun"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "IncidentSlaEvaluationRun_organizationId_status_idx" ON "IncidentSlaEvaluationRun"("organizationId", "status");

-- CreateIndex
CREATE INDEX "IncidentSlaEscalation_organizationId_status_breachType_idx" ON "IncidentSlaEscalation"("organizationId", "status", "breachType");

-- CreateIndex
CREATE INDEX "IncidentSlaEscalation_incidentId_detectedAt_idx" ON "IncidentSlaEscalation"("incidentId", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentSlaEscalation_organizationId_fingerprint_key" ON "IncidentSlaEscalation"("organizationId", "fingerprint");

-- AddForeignKey
ALTER TABLE "IncidentSlaEvaluationRun" ADD CONSTRAINT "IncidentSlaEvaluationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentSlaEscalation" ADD CONSTRAINT "IncidentSlaEscalation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentSlaEscalation" ADD CONSTRAINT "IncidentSlaEscalation_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "InfrastructureIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
