-- CreateTable
CREATE TABLE "BackupJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "retentionDays" INTEGER,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisasterRecoveryPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "primarySite" TEXT NOT NULL,
    "recoverySite" TEXT NOT NULL,
    "primaryStatus" TEXT NOT NULL DEFAULT 'OPERATIONAL',
    "recoveryStatus" TEXT NOT NULL DEFAULT 'READY',
    "replicationStatus" TEXT NOT NULL DEFAULT 'SYNCHRONIZED',
    "lastSyncAt" TIMESTAMP(3),
    "rpoMinutes" INTEGER NOT NULL,
    "rtoMinutes" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisasterRecoveryPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackupJob_organizationId_status_idx" ON "BackupJob"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DisasterRecoveryPlan_organizationId_key" ON "DisasterRecoveryPlan"("organizationId");

-- AddForeignKey
ALTER TABLE "BackupJob" ADD CONSTRAINT "BackupJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisasterRecoveryPlan" ADD CONSTRAINT "DisasterRecoveryPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
