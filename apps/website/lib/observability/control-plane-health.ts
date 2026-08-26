import type { ProxmoxInstance } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildNocHealthModel } from "@/lib/observability/noc-health";
import { classifyConnectorFailure } from "@/lib/observability/connector-failure-classifier";

export type ControlPlaneHealthState =
  | "HEALTHY"
  | "DEGRADED"
  | "CRITICAL"
  | "UNKNOWN";

export type ControlPlaneConfidence = "HIGH" | "MEDIUM" | "LOW";

type DomainHealth = {
  state: ControlPlaneHealthState;
  score: number | null;
  confidence: ControlPlaneConfidence;
  freshnessMinutes: number | null;
  blockers: string[];
  warnings: string[];
  evidence: Record<string, unknown>;
};

const DISCOVERY_FRESHNESS_MINUTES = 15;
const PROXMOX_FRESHNESS_MINUTES = 15;
const AUTOMATION_FRESHNESS_MINUTES = 30;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ageMinutes(value: Date | null | undefined) {
  if (!value) return null;

  return Math.max(
    0,
    Math.floor((Date.now() - value.getTime()) / 60000),
  );
}

function confidenceFromFreshness(
  age: number | null,
  maxAge: number,
): ControlPlaneConfidence {
  if (age === null) return "LOW";
  if (age <= maxAge) return "HIGH";
  if (age <= maxAge * 2) return "MEDIUM";
  return "LOW";
}

function normalizeState(
  state: string | null | undefined,
): ControlPlaneHealthState {
  switch (state?.toUpperCase()) {
    case "HEALTHY":
      return "HEALTHY";
    case "DEGRADED":
      return "DEGRADED";
    case "CRITICAL":
      return "CRITICAL";
    default:
      return "UNKNOWN";
  }
}

function worstState(
  states: ControlPlaneHealthState[],
): ControlPlaneHealthState {
  if (states.includes("CRITICAL")) return "CRITICAL";
  if (states.includes("DEGRADED")) return "DEGRADED";
  if (states.includes("UNKNOWN")) return "UNKNOWN";
  return "HEALTHY";
}

export async function buildControlPlaneHealth(
  organizationId: string,
) {
  const [
    discoveryConfig,
    latestDiscoveryRun,
    proxmoxInstances,
    latestReconciliation,
    latestSlaRun,
    noc,
  ] = await Promise.all([
    prisma.discoveryAutomationConfig.findUnique({
      where: { organizationId },
    }),

    prisma.discoveryAutomationRun.findFirst({
      where: { organizationId },
      orderBy: { startedAt: "desc" },
    }),

    prisma.proxmoxInstance.findMany({
      where: {
        organizationId,
        enabled: true,
      },
      orderBy: { name: "asc" },
    }),

    prisma.incidentReconciliationRun.findFirst({
      where: { organizationId },
      orderBy: { startedAt: "desc" },
    }),

    prisma.incidentSlaEvaluationRun.findFirst({
      where: { organizationId },
      orderBy: { startedAt: "desc" },
    }),

    buildNocHealthModel(organizationId),
  ]);

  const typedProxmoxInstances =
    proxmoxInstances as ProxmoxInstance[];

  /*
   * DISCOVERY
   */
  const discoveryAge = ageMinutes(
    latestDiscoveryRun?.finishedAt ??
      latestDiscoveryRun?.startedAt ??
      discoveryConfig?.lastRunAt,
  );

  const discoveryBlockers: string[] = [];
  const discoveryWarnings: string[] = [];

  let discoveryState: ControlPlaneHealthState = "UNKNOWN";
  let discoveryScore: number | null = null;

  if (!latestDiscoveryRun) {
    discoveryBlockers.push("DISCOVERY_NO_DATA");
  } else if (
    discoveryAge === null ||
    discoveryAge > DISCOVERY_FRESHNESS_MINUTES
  ) {
    discoveryState = "UNKNOWN";
    discoveryScore = null;
    discoveryBlockers.push("DISCOVERY_STALE");
  } else if (latestDiscoveryRun.status === "COMPLETED") {
    discoveryState = "HEALTHY";
    discoveryScore = 100;
  } else if (latestDiscoveryRun.status === "DEGRADED") {
    discoveryState = "DEGRADED";
    discoveryScore = 60;
    discoveryWarnings.push("DISCOVERY_PARTIAL_FAILURE");
  } else if (latestDiscoveryRun.status === "FAILED") {
    discoveryState = "CRITICAL";
    discoveryScore = 20;
    discoveryBlockers.push("DISCOVERY_FAILED");
  } else {
    discoveryState = "UNKNOWN";
    discoveryScore = null;
    discoveryWarnings.push(
      `DISCOVERY_STATUS_${latestDiscoveryRun.status}`,
    );
  }

  if ((discoveryConfig?.consecutiveFailures ?? 0) > 0) {
    discoveryWarnings.push("DISCOVERY_CONSECUTIVE_FAILURES");

    if (
      discoveryState === "HEALTHY" &&
      (discoveryConfig?.consecutiveFailures ?? 0) > 0
    ) {
      discoveryState = "DEGRADED";
      discoveryScore = Math.min(discoveryScore ?? 100, 75);
    }
  }

  const discovery: DomainHealth = {
    state: discoveryState,
    score: discoveryScore,
    confidence: confidenceFromFreshness(
      discoveryAge,
      DISCOVERY_FRESHNESS_MINUTES,
    ),
    freshnessMinutes: discoveryAge,
    blockers: discoveryBlockers,
    warnings: discoveryWarnings,
    evidence: {
      enabled: discoveryConfig?.enabled ?? false,
      reconciliationEnabled:
        discoveryConfig?.reconciliationEnabled ?? false,
      latestRunId: latestDiscoveryRun?.id ?? null,
      latestRunStatus: latestDiscoveryRun?.status ?? null,
      succeeded: latestDiscoveryRun?.succeeded ?? null,
      failed: latestDiscoveryRun?.failed ?? null,
      instancesTotal: latestDiscoveryRun?.instancesTotal ?? null,
      lastSuccessAt: discoveryConfig?.lastSuccessAt ?? null,
      lastFailureAt: discoveryConfig?.lastFailureAt ?? null,
      consecutiveFailures:
        discoveryConfig?.consecutiveFailures ?? 0,
      lastError: discoveryConfig?.lastError ?? null,
    },
  };

  /*
   * PROXMOX
   */
  const proxmoxAges = typedProxmoxInstances
    .map((instance) =>
      ageMinutes(instance.lastSyncAt ?? instance.lastHealthAt),
    )
    .filter((value): value is number => value !== null);

  const proxmoxFreshness =
    proxmoxAges.length > 0 ? Math.max(...proxmoxAges) : null;

  const proxmoxHealthy = typedProxmoxInstances.filter(
    (instance) =>
      instance.status === "HEALTHY" ||
      instance.status === "ONLINE",
  ).length;

  const proxmoxBlockers: string[] = [];
  const proxmoxWarnings: string[] = [];

  let proxmoxState: ControlPlaneHealthState;
  let proxmoxScore: number | null;

  if (typedProxmoxInstances.length === 0) {
    proxmoxState = "UNKNOWN";
    proxmoxScore = null;
    proxmoxBlockers.push("PROXMOX_NO_ENABLED_INSTANCES");
  } else if (
    proxmoxFreshness === null ||
    proxmoxFreshness > PROXMOX_FRESHNESS_MINUTES
  ) {
    proxmoxState = "UNKNOWN";
    proxmoxScore = null;
    proxmoxBlockers.push("PROXMOX_HEALTH_STALE");
  } else {
    const ratio = proxmoxHealthy / typedProxmoxInstances.length;
    proxmoxScore = clamp(ratio * 100);

    if (proxmoxHealthy === typedProxmoxInstances.length) {
      proxmoxState = "HEALTHY";
    } else if (proxmoxHealthy === 0) {
      proxmoxState = "CRITICAL";
      proxmoxBlockers.push("PROXMOX_ALL_INSTANCES_UNHEALTHY");
    } else {
      proxmoxState = "DEGRADED";
      proxmoxWarnings.push("PROXMOX_PARTIAL_AVAILABILITY");
    }
  }

  const proxmox: DomainHealth = {
    state: proxmoxState,
    score: proxmoxScore,
    confidence: confidenceFromFreshness(
      proxmoxFreshness,
      PROXMOX_FRESHNESS_MINUTES,
    ),
    freshnessMinutes: proxmoxFreshness,
    blockers: proxmoxBlockers,
    warnings: proxmoxWarnings,
    evidence: {
      total: typedProxmoxInstances.length,
      healthy: proxmoxHealthy,
      instances: typedProxmoxInstances.map((instance) => ({
        id: instance.id,
        name: instance.name,
        site: instance.site,
        status: instance.status,
        lastHealthAt: instance.lastHealthAt,
        lastSyncAt: instance.lastSyncAt,
        lastError: instance.lastError,
      })),
    },
  };

  /*
   * RECONCILIATION
   */
  const reconciliationAge = ageMinutes(
    latestReconciliation?.finishedAt ??
      latestReconciliation?.startedAt,
  );

  let reconciliationState: ControlPlaneHealthState = "UNKNOWN";
  let reconciliationScore: number | null = null;
  const reconciliationBlockers: string[] = [];
  const reconciliationWarnings: string[] = [];

  if (!latestReconciliation) {
    reconciliationWarnings.push("RECONCILIATION_NO_DATA");
  } else if (
    reconciliationAge !== null &&
    reconciliationAge > AUTOMATION_FRESHNESS_MINUTES
  ) {
    reconciliationState = "UNKNOWN";
    reconciliationWarnings.push("RECONCILIATION_STALE");
  } else if (latestReconciliation.status === "COMPLETED") {
    reconciliationState = "HEALTHY";
    reconciliationScore = 100;
  } else if (latestReconciliation.status === "FAILED") {
    reconciliationState = "CRITICAL";
    reconciliationScore = 20;
    reconciliationBlockers.push("RECONCILIATION_FAILED");
  } else {
    reconciliationState = "DEGRADED";
    reconciliationScore = 60;
    reconciliationWarnings.push(
      `RECONCILIATION_STATUS_${latestReconciliation.status}`,
    );
  }

  const reconciliation: DomainHealth = {
    state: reconciliationState,
    score: reconciliationScore,
    confidence: confidenceFromFreshness(
      reconciliationAge,
      AUTOMATION_FRESHNESS_MINUTES,
    ),
    freshnessMinutes: reconciliationAge,
    blockers: reconciliationBlockers,
    warnings: reconciliationWarnings,
    evidence: {
      latestRunId: latestReconciliation?.id ?? null,
      latestStatus: latestReconciliation?.status ?? null,
      inspected: latestReconciliation?.inspected ?? null,
      resolved: latestReconciliation?.resolved ?? null,
      skipped: latestReconciliation?.skipped ?? null,
      errors: latestReconciliation?.errors ?? null,
      errorMessage: latestReconciliation?.errorMessage ?? null,
    },
  };

  /*
   * INCIDENT AUTOMATION / SLA
   */
  const slaAge = ageMinutes(
    latestSlaRun?.finishedAt ?? latestSlaRun?.startedAt,
  );

  let incidentAutomationState: ControlPlaneHealthState = "UNKNOWN";
  let incidentAutomationScore: number | null = null;
  const incidentAutomationBlockers: string[] = [];
  const incidentAutomationWarnings: string[] = [];

  if (!latestSlaRun) {
    incidentAutomationWarnings.push("SLA_AUTOMATION_NO_DATA");
  } else if (
    slaAge !== null &&
    slaAge > AUTOMATION_FRESHNESS_MINUTES
  ) {
    incidentAutomationState = "UNKNOWN";
    incidentAutomationWarnings.push("SLA_AUTOMATION_STALE");
  } else if (latestSlaRun.status === "COMPLETED") {
    incidentAutomationState = "HEALTHY";
    incidentAutomationScore = 100;
  } else if (latestSlaRun.status === "FAILED") {
    incidentAutomationState = "CRITICAL";
    incidentAutomationScore = 20;
    incidentAutomationBlockers.push("SLA_AUTOMATION_FAILED");
  } else {
    incidentAutomationState = "DEGRADED";
    incidentAutomationScore = 60;
    incidentAutomationWarnings.push(
      `SLA_AUTOMATION_STATUS_${latestSlaRun.status}`,
    );
  }

  const incidentAutomation: DomainHealth = {
    state: incidentAutomationState,
    score: incidentAutomationScore,
    confidence: confidenceFromFreshness(
      slaAge,
      AUTOMATION_FRESHNESS_MINUTES,
    ),
    freshnessMinutes: slaAge,
    blockers: incidentAutomationBlockers,
    warnings: incidentAutomationWarnings,
    evidence: {
      latestRunId: latestSlaRun?.id ?? null,
      latestStatus: latestSlaRun?.status ?? null,
      inspected: latestSlaRun?.inspected ?? null,
      errors: latestSlaRun?.errors ?? null,
      errorMessage: latestSlaRun?.errorMessage ?? null,
    },
  };

  /*
   * NOTIFICATIONS / SLO
   *
   * Existing NOC health remains authoritative for this domain.
   */
  const nocState = normalizeState(noc.state);

  const notifications: DomainHealth = {
    state: nocState,
    score: noc.nocHealthScore,
    confidence:
      noc.nocHealthScore === null ? "LOW" : "HIGH",
    freshnessMinutes: null,
    blockers:
      nocState === "CRITICAL"
        ? ["NOTIFICATION_NOC_CRITICAL"]
        : [],
    warnings:
      nocState === "DEGRADED"
        ? ["NOTIFICATION_NOC_DEGRADED"]
        : [],
    evidence: {
      nocHealthScore: noc.nocHealthScore,
      state: noc.state,
    },
  };

  const slo: DomainHealth = {
    ...notifications,
    evidence: {
      source: "EXISTING_NOC_HEALTH_MODEL",
      nocHealthScore: noc.nocHealthScore,
      state: noc.state,
    },
  };

  const domains = {
    discovery,
    proxmox,
    reconciliation,
    incidentAutomation,
    notifications,
    slo,
  };

  const domainValues = Object.values(domains);

  const numericScores = domainValues
    .map((domain) => domain.score)
    .filter((score): score is number => score !== null);

  let score =
    numericScores.length > 0
      ? clamp(
          numericScores.reduce((sum, value) => sum + value, 0) /
            numericScores.length,
        )
      : null;

  let state = worstState(
    domainValues.map((domain) => domain.state),
  );

  /*
   * Critical-domain caps.
   */
  if (
    discovery.state === "CRITICAL" ||
    proxmox.state === "CRITICAL"
  ) {
    state = "CRITICAL";
    score = score === null ? 25 : Math.min(score, 49);
  } else if (
    discovery.state === "DEGRADED" ||
    proxmox.state === "DEGRADED"
  ) {
    if (state === "HEALTHY") state = "DEGRADED";
    score = score === null ? 70 : Math.min(score, 79);
  }

  const blockers = domainValues.flatMap(
    (domain) => domain.blockers,
  );

  const warnings = domainValues.flatMap(
    (domain) => domain.warnings,
  );

  const lowConfidence = domainValues.filter(
    (domain) => domain.confidence === "LOW",
  ).length;

  const confidence: ControlPlaneConfidence =
    lowConfidence === 0
      ? "HIGH"
      : lowConfidence <= 2
        ? "MEDIUM"
        : "LOW";

  const lastFailureAt = discoveryConfig?.lastFailureAt ?? null;
  const lastSuccessAt = discoveryConfig?.lastSuccessAt ?? null;

  const recovered =
    Boolean(lastFailureAt) &&
    Boolean(lastSuccessAt) &&
    lastSuccessAt!.getTime() > lastFailureAt!.getTime() &&
    discovery.state === "HEALTHY" &&
    proxmox.state === "HEALTHY";

  const rootCauses: Array<{
    domain: "DISCOVERY" | "PROXMOX";
    instanceId: string | null;
    instanceName: string | null;
    site: string | null;
    category: string;
    reason: string;
    severity: string;
    retryable: boolean;
    recoverable: boolean;
    recommendedAction: string;
    rawMessage: string | null;
  }> = [];

  const latestDetails =
    Array.isArray(latestDiscoveryRun?.details)
      ? latestDiscoveryRun.details
      : [];

  for (const item of latestDetails) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

    const record = item as Record<string, unknown>;
    if (record.kind !== "INSTANCE" || record.status !== "FAILED") continue;

    const failure =
      record.failure &&
      typeof record.failure === "object" &&
      !Array.isArray(record.failure)
        ? (record.failure as Record<string, unknown>)
        : null;

    if (failure) {
      rootCauses.push({
        domain: "DISCOVERY",
        instanceId: typeof record.instanceId === "string" ? record.instanceId : null,
        instanceName: typeof record.name === "string" ? record.name : null,
        site: typeof record.site === "string" ? record.site : null,
        category: typeof failure.category === "string" ? failure.category : "UNKNOWN",
        reason: typeof failure.reason === "string" ? failure.reason : "UNKNOWN_CONNECTOR_ERROR",
        severity: typeof failure.severity === "string" ? failure.severity : "CRITICAL",
        retryable: failure.retryable === true,
        recoverable: failure.recoverable === true,
        recommendedAction:
          typeof failure.recommendedAction === "string"
            ? failure.recommendedAction
            : "Executar diagnóstico manual.",
        rawMessage: typeof record.error === "string" ? record.error : null,
      });
      continue;
    }

    if (typeof record.error === "string") {
      const classified = classifyConnectorFailure(record.error);
      rootCauses.push({
        domain: "DISCOVERY",
        instanceId: typeof record.instanceId === "string" ? record.instanceId : null,
        instanceName: typeof record.name === "string" ? record.name : null,
        site: typeof record.site === "string" ? record.site : null,
        category: classified.category,
        reason: classified.reason,
        severity: classified.severity,
        retryable: classified.retryable,
        recoverable: classified.recoverable,
        recommendedAction: classified.recommendedAction,
        rawMessage: classified.rawMessage,
      });
    }
  }

  for (const instance of typedProxmoxInstances) {
    if (
      (instance.status === "HEALTHY" || instance.status === "ONLINE") &&
      !instance.lastError
    ) continue;

    if (rootCauses.some((item) => item.instanceId === instance.id)) continue;

    if (instance.lastError) {
      const classified = classifyConnectorFailure(instance.lastError);
      rootCauses.push({
        domain: "PROXMOX",
        instanceId: instance.id,
        instanceName: instance.name,
        site: instance.site,
        category: classified.category,
        reason: classified.reason,
        severity: classified.severity,
        retryable: classified.retryable,
        recoverable: classified.recoverable,
        recommendedAction: classified.recommendedAction,
        rawMessage: classified.rawMessage,
      });
    }
  }

  const blockedCapabilities = Array.from(
    new Set(
      rootCauses.flatMap((cause) => {
        switch (cause.category) {
          case "CONNECTIVITY":
          case "TLS":
          case "AUTHENTICATION":
          case "AUTHORIZATION":
          case "CONFIGURATION":
            return [
              "FULL_DISCOVERY",
              "INCIDENT_RECONCILIATION",
              "POST_CLOSURE_REGRESSION_GUARD",
            ];
          case "API":
          case "PROTOCOL":
            return ["FULL_DISCOVERY"];
          default:
            return [];
        }
      }),
    ),
  );

  return {
    version: "015.6.11.7.1",
    state,
    score,
    confidence,
    domains,
    blockers,
    warnings,
    rootCauses,
    blockedCapabilities,
    recovery: {
      state: recovered
        ? "RECOVERED"
        : lastFailureAt &&
            (!lastSuccessAt ||
              lastSuccessAt.getTime() <= lastFailureAt.getTime())
          ? "DEGRADED"
          : "STABLE",
      lastFailureAt,
      lastSuccessAt,
      consecutiveDiscoveryFailures:
        discoveryConfig?.consecutiveFailures ?? 0,
    },
    evaluatedAt: new Date(),
  };
}
