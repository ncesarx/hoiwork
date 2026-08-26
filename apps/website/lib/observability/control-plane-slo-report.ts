import { prisma } from "@/lib/prisma";

const CURRENT_SLO_SEMANTIC_VERSION = "015.6.11.7.4.4.1";
const MIN_SEMANTIC_SAMPLES = 3;

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function calculateSlo(input: {
  snapshots: Array<{ overallState: string }>;
  target: number;
  degradedWeight: number;
  criticalWeight: number;
}) {
  const states = {
    healthy: input.snapshots.filter((s) => s.overallState === "HEALTHY").length,
    degraded: input.snapshots.filter((s) => s.overallState === "DEGRADED").length,
    critical: input.snapshots.filter((s) => s.overallState === "CRITICAL").length,
    unknown: input.snapshots.filter((s) => s.overallState === "UNKNOWN").length,
  };

  if (input.snapshots.length === 0) {
    return {
      sampleCount: 0,
      availability: null,
      errorBudgetPercent: null,
      burnRate: null,
      burnState: "NO_DATA",
      states,
    };
  }

  const weights = input.snapshots.map((snapshot) =>
    snapshot.overallState === "HEALTHY"
      ? 1
      : snapshot.overallState === "DEGRADED"
        ? input.degradedWeight
        : snapshot.overallState === "CRITICAL"
          ? input.criticalWeight
          : 0,
  );

  const availability =
    (weights.reduce((sum, value) => sum + value, 0) /
      weights.length) *
    100;

  const allowedBad = Math.max(0.0001, 100 - input.target);
  const actualBad = Math.max(0, 100 - availability);
  const burnRate = actualBad / allowedBad;
  const errorBudgetPercent = clamp(100 - burnRate * 100);

  return {
    sampleCount: input.snapshots.length,
    availability,
    errorBudgetPercent,
    burnRate,
    burnState:
      burnRate >= 10
        ? "CRITICAL"
        : burnRate >= 2
          ? "DEGRADED"
          : "HEALTHY",
    states,
  };
}

export async function buildControlPlaneSloReport(
  organizationId: string,
  hours = 24,
) {
  const policy = await prisma.controlPlaneSloPolicy.upsert({
    where: { organizationId },
    update: {},
    create: {
      organizationId,
      enabled: false,
      availabilityTarget: 99.5,
      degradedWeight: 0.5,
      criticalWeight: 0,
      snapshotIntervalMinutes: 5,
      retentionDays: 90,
    },
  });

  const since = new Date(Date.now() - hours * 3600000);

  const [allSnapshots, semanticSnapshots, semanticEpoch] =
    await Promise.all([
      prisma.controlPlaneHealthSnapshot.findMany({
        where: {
          organizationId,
          capturedAt: { gte: since },
        },
        select: { overallState: true },
        orderBy: { capturedAt: "asc" },
      }),

      prisma.controlPlaneHealthSnapshot.findMany({
        where: {
          organizationId,
          capturedAt: { gte: since },
          metadata: {
            path: ["version"],
            equals: CURRENT_SLO_SEMANTIC_VERSION,
          },
        },
        select: {
          overallState: true,
          capturedAt: true,
        },
        orderBy: { capturedAt: "asc" },
      }),

      prisma.controlPlaneHealthSnapshot.findFirst({
        where: {
          organizationId,
          metadata: {
            path: ["version"],
            equals: CURRENT_SLO_SEMANTIC_VERSION,
          },
        },
        select: { capturedAt: true },
        orderBy: { capturedAt: "asc" },
      }),
    ]);

  const current = calculateSlo({
    snapshots: semanticSnapshots,
    target: policy.availabilityTarget,
    degradedWeight: policy.degradedWeight,
    criticalWeight: policy.criticalWeight,
  });

  const historical = calculateSlo({
    snapshots: allSnapshots,
    target: policy.availabilityTarget,
    degradedWeight: policy.degradedWeight,
    criticalWeight: policy.criticalWeight,
  });

  const semanticEvidenceReady =
    current.sampleCount >= MIN_SEMANTIC_SAMPLES;

  return {
    version: "015.6.11.7.4.4.2",
    windowHours: hours,
    policy,

    semanticEpoch: {
      version: CURRENT_SLO_SEMANTIC_VERSION,
      startedAt: semanticEpoch?.capturedAt ?? null,
      minimumSamples: MIN_SEMANTIC_SAMPLES,
      sampleCount: current.sampleCount,
      evidenceReady: semanticEvidenceReady,
    },

    sampleCount: current.sampleCount,
    availability: semanticEvidenceReady
      ? current.availability
      : null,
    target: policy.availabilityTarget,
    errorBudgetPercent: semanticEvidenceReady
      ? current.errorBudgetPercent
      : null,
    burnRate: semanticEvidenceReady
      ? current.burnRate
      : null,
    burnState: semanticEvidenceReady
      ? current.burnState
      : "NO_DATA",
    states: current.states,

    historical: {
      windowHours: hours,
      sampleCount: historical.sampleCount,
      availability: historical.availability,
      errorBudgetPercent: historical.errorBudgetPercent,
      burnRate: historical.burnRate,
      burnState: historical.burnState,
      states: historical.states,
    },
  };
}
