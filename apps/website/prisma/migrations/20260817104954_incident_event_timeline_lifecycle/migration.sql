-- CreateTable
CREATE TABLE "InfrastructureIncidentEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "fromSeverity" TEXT,
    "toSeverity" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfrastructureIncidentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfrastructureIncidentNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfrastructureIncidentNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InfrastructureIncidentEvent_organizationId_incidentId_creat_idx" ON "InfrastructureIncidentEvent"("organizationId", "incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "InfrastructureIncidentNote_organizationId_incidentId_create_idx" ON "InfrastructureIncidentNote"("organizationId", "incidentId", "createdAt");

-- AddForeignKey
ALTER TABLE "InfrastructureIncidentEvent" ADD CONSTRAINT "InfrastructureIncidentEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "InfrastructureIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfrastructureIncidentEvent" ADD CONSTRAINT "InfrastructureIncidentEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfrastructureIncidentNote" ADD CONSTRAINT "InfrastructureIncidentNote_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "InfrastructureIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfrastructureIncidentNote" ADD CONSTRAINT "InfrastructureIncidentNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
