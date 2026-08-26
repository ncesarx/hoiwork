import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildPostRemediationAssurance } from "@/lib/incidents/post-remediation-assurance";

export type StabilityState =
  | "NOT_APPLICABLE"
  | "STABILITY_PENDING"
  | "RECOVERY_STABLE";

function jsonObject(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, Prisma.JsonValue>;
  }
  return value as Record<string, Prisma.JsonValue>;
}

function numberValue(value: Prisma.JsonValue | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringValue(value: Prisma.JsonValue | undefined) {
  return typeof value === "string" ? value : null;
}

export async function buildPostRemediationStability(
  organizationId: string,
  incidentId: string,
) {
  const [assurance, incident, discoveryConfig] = await Promise.all([
    buildPostRemediationAssurance(organizationId, incidentId),
    prisma.infrastructureIncident.findFirst({
      where: { id: incidentId, organizationId },
    }),
    prisma.discoveryAutomationConfig.findFirst({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  if (!assurance || !incident) return null;

  const metadata = jsonObject(incident.metadata);

  const evidenceCount = numberValue(
    metadata.postRemediationStabilityEvidenceCount,
  );

  const firstObservedAtRaw = stringValue(
    metadata.postRemediationStabilityFirstObservedAt,
  );

  const lastObservedAtRaw = stringValue(
    metadata.postRemediationStabilityLastObservedAt,
  );

  const firstObservedAt = firstObservedAtRaw
    ? new Date(firstObservedAtRaw)
    : null;

  const lastObservedAt = lastObservedAtRaw
    ? new Date(lastObservedAtRaw)
    : null;

  const intervalMinutes = Math.max(
    1,
    discoveryConfig?.intervalMinutes ?? 5,
  );

  // 3 independent healthy observations on a 5 minute cadence span ~10 minutes.
  const requiredEvidenceCount = 3;
  const minimumStableSeconds = Math.max(600, intervalMinutes * 2 * 60);

  const stableForSeconds =
    firstObservedAt && lastObservedAt
      ? Math.max(
          0,
          Math.floor(
            (lastObservedAt.getTime() - firstObservedAt.getTime()) / 1000,
          ),
        )
      : 0;

  const stableEvidenceEnough =
    evidenceCount >= requiredEvidenceCount &&
    stableForSeconds >= minimumStableSeconds;

  const recoveryStillObserved =
    assurance.recoveryObserved === true &&
    assurance.asset?.active === true &&
    assurance.expectedState !== null &&
    assurance.asset.status.toUpperCase() === assurance.expectedState;

  let stabilityState: StabilityState = "NOT_APPLICABLE";

  if (assurance.execution?.status === "COMPLETED") {
    stabilityState =
      stableEvidenceEnough && recoveryStillObserved
        ? "RECOVERY_STABLE"
        : "STABILITY_PENDING";
  }

  const observabilityWarnings: string[] = [];

  if (discoveryConfig?.enabled !== true) {
    observabilityWarnings.push("DISCOVERY_AUTOMATION_DISABLED");
  }

  if ((discoveryConfig?.consecutiveFailures ?? 0) > 0) {
    observabilityWarnings.push("DISCOVERY_AUTOMATION_DEGRADED");
  }

  if (discoveryConfig?.lastError) {
    observabilityWarnings.push(
      `DISCOVERY_LAST_ERROR:${discoveryConfig.lastError}`,
    );
  }

  const closureReady =
    stabilityState === "RECOVERY_STABLE" &&
    assurance.assuranceState === "RECOVERY_VERIFIED" &&
    assurance.recoveryVerified === true;

  const blockers: string[] = [];

  if (assurance.execution?.status !== "COMPLETED") {
    blockers.push("REAL_EXECUTION_NOT_COMPLETED");
  }

  if (!recoveryStillObserved) {
    blockers.push("RECOVERY_NOT_CURRENTLY_OBSERVED");
  }

  if (evidenceCount < requiredEvidenceCount) {
    blockers.push("INSUFFICIENT_STABILITY_EVIDENCE");
  }

  if (stableForSeconds < minimumStableSeconds) {
    blockers.push("MINIMUM_STABILITY_DURATION_NOT_MET");
  }

  if (assurance.recoveryVerified !== true) {
    blockers.push("RECOVERY_NOT_VERIFIED");
  }

  // 6.4.2 can say closure-ready, but cannot mutate the lifecycle.
  blockers.push("AUTO_CLOSURE_NOT_ENABLED_IN_6_4_2");

  return {
    version: "015.6.11.6.4.2",
    generatedAt: new Date(),
    incidentId,
    incidentStatus: incident.status,
    assuranceState: assurance.assuranceState,
    confidenceScore: assurance.confidenceScore,
    recoveryObserved: assurance.recoveryObserved,
    recoveryVerified: assurance.recoveryVerified,
    stabilityState,
    evidenceCount,
    requiredEvidenceCount,
    firstObservedAt,
    lastObservedAt,
    stableForSeconds,
    minimumStableSeconds,
    intervalMinutes,
    closureReady,
    closureEligible: false,
    blockers,
    observability: {
      enabled: discoveryConfig?.enabled ?? false,
      intervalMinutes,
      lastRunAt: discoveryConfig?.lastRunAt ?? null,
      lastSuccessAt: discoveryConfig?.lastSuccessAt ?? null,
      lastFailureAt: discoveryConfig?.lastFailureAt ?? null,
      consecutiveFailures: discoveryConfig?.consecutiveFailures ?? 0,
      lastError: discoveryConfig?.lastError ?? null,
      warnings: observabilityWarnings,
    },
  };
}
