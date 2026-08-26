import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildControlPlaneHealth } from "@/lib/observability/control-plane-health";
import { classifyControlPlaneSnapshotForSlo } from "@/lib/observability/control-plane-slo-state-filter";

export async function captureControlPlaneHealthSnapshot(organizationId: string) {
  const health = await buildControlPlaneHealth(organizationId);

  const sloClassification =
    classifyControlPlaneSnapshotForSlo({
      rawState: health.state,
      score: health.score,
      confidence: health.confidence,
      blockers: health.blockers,
      warnings: health.warnings,
      rootCauseCount: health.rootCauses.length,
      blockedCapabilityCount: health.blockedCapabilities.length,
    });

  return prisma.controlPlaneHealthSnapshot.create({
    data: {
      organizationId,
      capturedAt: new Date(),
      overallState: sloClassification.sloState,
      overallScore: health.score,
      confidence: health.confidence,
      discoveryState: health.domains.discovery.state,
      proxmoxState: health.domains.proxmox.state,
      reconciliationState: health.domains.reconciliation.state,
      incidentAutomationState: health.domains.incidentAutomation.state,
      notificationsState: health.domains.notifications.state,
      sloState: health.domains.slo.state,
      rootCauseCount: health.rootCauses.length,
      blockedCapabilityCount: health.blockedCapabilities.length,
      metadata: {
        version: "015.6.11.7.4.4.1",
        rawOverallState: health.state,
        sloOverallState: sloClassification.sloState,
        sloStateNormalized: sloClassification.normalized,
        sloStateNormalizationReason: sloClassification.reason,
        transientWarnings: sloClassification.transientWarnings,
        nonTransientWarnings: sloClassification.nonTransientWarnings,
        blockers: health.blockers,
        warnings: health.warnings,
        rootCauses: health.rootCauses,
        blockedCapabilities: health.blockedCapabilities,
        recovery: health.recovery,
      } as Prisma.InputJsonValue,
    },
  });
}
