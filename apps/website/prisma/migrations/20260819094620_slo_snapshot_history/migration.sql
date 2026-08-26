-- CreateTable
CREATE TABLE "NotificationSloSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallState" TEXT NOT NULL,
    "nocHealthScore" INTEGER,
    "burnState" TEXT NOT NULL,
    "deliverySuccess1h" DOUBLE PRECISION,
    "deliverySuccess24h" DOUBLE PRECISION,
    "deliverySuccess7d" DOUBLE PRECISION,
    "retryRate1h" DOUBLE PRECISION,
    "retryRate24h" DOUBLE PRECISION,
    "retryRate7d" DOUBLE PRECISION,
    "errorBudget1h" DOUBLE PRECISION,
    "errorBudget24h" DOUBLE PRECISION,
    "errorBudget7d" DOUBLE PRECISION,
    "burnRate1h" DOUBLE PRECISION,
    "burnRate24h" DOUBLE PRECISION,
    "burnRate7d" DOUBLE PRECISION,
    "connectorScore" INTEGER,
    "automationSuccess24h" DOUBLE PRECISION,
    "metadata" JSONB,

    CONSTRAINT "NotificationSloSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationSloSnapshot_organizationId_capturedAt_idx" ON "NotificationSloSnapshot"("organizationId", "capturedAt");

-- CreateIndex
CREATE INDEX "NotificationSloSnapshot_organizationId_overallState_idx" ON "NotificationSloSnapshot"("organizationId", "overallState");

-- AddForeignKey
ALTER TABLE "NotificationSloSnapshot" ADD CONSTRAINT "NotificationSloSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
