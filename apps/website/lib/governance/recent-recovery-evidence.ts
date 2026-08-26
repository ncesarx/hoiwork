import { prisma } from "@/lib/prisma";

const RECOVERY_WINDOW_SAMPLES = 6;
const CURRENT_SEMANTIC_VERSION = "015.6.11.7.4.4.1";

export async function evaluateRecentRecoveryEvidence(
  organizationId: string,
) {
  const snapshots = await prisma.controlPlaneHealthSnapshot.findMany({
    where: {
      organizationId,
      metadata: {
        path: ["version"],
        equals: CURRENT_SEMANTIC_VERSION,
      },
    },
    orderBy: { capturedAt: "desc" },
    take: RECOVERY_WINDOW_SAMPLES,
    select: {
      id: true,
      capturedAt: true,
      overallState: true,
      overallScore: true,
      confidence: true,
      rootCauseCount: true,
      blockedCapabilityCount: true,
      metadata: true,
    },
  });

  const enoughSamples = snapshots.length >= RECOVERY_WINDOW_SAMPLES;
  const allHealthy =
    enoughSamples && snapshots.every((s) => s.overallState === "HEALTHY");
  const allHighConfidence =
    enoughSamples && snapshots.every((s) => s.confidence === "HIGH");
  const noRootCauses =
    enoughSamples && snapshots.every((s) => s.rootCauseCount === 0);
  const noBlockedCapabilities =
    enoughSamples &&
    snapshots.every((s) => s.blockedCapabilityCount === 0);

  return {
    version: "015.6.11.7.4.4.3",
    semanticVersion: CURRENT_SEMANTIC_VERSION,
    requiredSamples: RECOVERY_WINDOW_SAMPLES,
    sampleCount: snapshots.length,
    eligible:
      enoughSamples &&
      allHealthy &&
      allHighConfidence &&
      noRootCauses &&
      noBlockedCapabilities,
    checks: {
      enoughSamples,
      allHealthy,
      allHighConfidence,
      noRootCauses,
      noBlockedCapabilities,
    },
    evidence: snapshots,
  };
}
