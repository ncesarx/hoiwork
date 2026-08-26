-- CreateTable
CREATE TABLE "ProxmoxInstance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "site" TEXT,
    "baseUrl" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "tokenSecretEncrypted" TEXT NOT NULL,
    "allowSelfSigned" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastHealthAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProxmoxInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProxmoxInstance_organizationId_enabled_idx" ON "ProxmoxInstance"("organizationId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ProxmoxInstance_organizationId_slug_key" ON "ProxmoxInstance"("organizationId", "slug");

-- AddForeignKey
ALTER TABLE "ProxmoxInstance" ADD CONSTRAINT "ProxmoxInstance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
