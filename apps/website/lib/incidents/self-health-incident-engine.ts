import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildControlPlaneHealth } from "@/lib/observability/control-plane-health";

type SelfHealthDomain =
  | "DISCOVERY"
  | "PROXMOX"
  | "RECONCILIATION"
  | "INCIDENT_AUTOMATION"
  | "NOTIFICATIONS"
  | "SLO";

type DomainDecision = {
  domain: SelfHealthDomain;
  state: "HEALTHY" | "DEGRADED" | "CRITICAL" | "UNKNOWN";
  persistent: boolean;
  eligibleForIncident: boolean;
  reason: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  score: number | null;
  evidence: Record<string, unknown>;
};

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function severityFor(state: DomainDecision["state"]) {
  if (state === "CRITICAL") return "CRITICAL" as const;
  if (state === "DEGRADED") return "HIGH" as const;
  if (state === "UNKNOWN") return "MEDIUM" as const;
  return "LOW" as const;
}

function domainAsset(domain: SelfHealthDomain) {
  return {
    externalId: `control-plane/${domain.toLowerCase()}`,
    name: `HOIWORK Control Plane / ${domain}`,
    type: "CONTROL_PLANE",
  };
}

export async function evaluateSelfHealthIncidents(
  organizationId: string,
) {
  const [
    health,
    discoveryConfig,
    discoveryRuns,
    reconciliationRuns,
    slaRuns,
    openSloAlerts,
    latestControlPlaneSloRun,
  ] = await Promise.all([
    buildControlPlaneHealth(organizationId),

    prisma.discoveryAutomationConfig.findUnique({
      where: { organizationId },
    }),

    prisma.discoveryAutomationRun.findMany({
      where: { organizationId },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),

    prisma.incidentReconciliationRun.findMany({
      where: { organizationId },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),

    prisma.incidentSlaEvaluationRun.findMany({
      where: { organizationId },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),

    prisma.notificationSloTrendAlert.count({
      where: {
        organizationId,
        status: "OPEN",
      },
    }),

    prisma.controlPlaneSloAutomationRun.findFirst({
      where: { organizationId, status: "COMPLETED" },
      orderBy: { finishedAt: "desc" },
    }),
  ]);

  const recentDiscoveryFailures = discoveryRuns.filter(
    (run) => run.status === "DEGRADED" || run.status === "FAILED",
  ).length;

  const recentReconciliationFailures = reconciliationRuns.filter(
    (run) => run.status === "FAILED",
  ).length;

  const recentSlaFailures = slaRuns.filter(
    (run) => run.status === "FAILED",
  ).length;

  const proxmoxRootCauses = health.rootCauses.filter(
    (cause) =>
      cause.domain === "PROXMOX" ||
      cause.domain === "DISCOVERY",
  );

  const controlPlaneBurnRate =
    latestControlPlaneSloRun?.burnRate ?? null;

  const controlPlaneErrorBudget =
    latestControlPlaneSloRun?.errorBudgetPercent ?? null;

  const controlPlaneBurnState =
    latestControlPlaneSloRun?.burnState ?? "NO_DATA";

  const sloPressure =
    controlPlaneBurnRate !== null &&
    (controlPlaneBurnRate >= 2 || controlPlaneErrorBudget === 0);

  const sloCriticalPressure =
    controlPlaneBurnRate !== null &&
    (controlPlaneBurnRate >= 10 || controlPlaneErrorBudget === 0);

  const decisions: DomainDecision[] = [
    {
      domain: "DISCOVERY",
      state: health.domains.discovery.state,
      persistent:
        (discoveryConfig?.consecutiveFailures ?? 0) >= 3 ||
        recentDiscoveryFailures >= 3 ||
        sloPressure,
      eligibleForIncident: false,
      reason: "EVALUATING",
      severity: severityFor(health.domains.discovery.state),
      score: health.domains.discovery.score,
      evidence: {
        consecutiveFailures:
          discoveryConfig?.consecutiveFailures ?? 0,
        recentFailureRuns: recentDiscoveryFailures,
        lastError: discoveryConfig?.lastError ?? null,
        controlPlaneBurnRate,
        controlPlaneErrorBudget,
        controlPlaneBurnState,
        sloPressure,
      },
    },
    {
      domain: "PROXMOX",
      state: health.domains.proxmox.state,
      persistent:
        proxmoxRootCauses.length > 0 &&
        (
          (discoveryConfig?.consecutiveFailures ?? 0) >= 3 ||
          recentDiscoveryFailures >= 3 ||
          sloPressure
        ),
      eligibleForIncident: false,
      reason: "EVALUATING",
      severity: severityFor(health.domains.proxmox.state),
      score: health.domains.proxmox.score,
      evidence: {
        rootCauses: proxmoxRootCauses,
        consecutiveDiscoveryFailures:
          discoveryConfig?.consecutiveFailures ?? 0,
        controlPlaneBurnRate,
        controlPlaneErrorBudget,
        controlPlaneBurnState,
        sloPressure,
      },
    },
    {
      domain: "RECONCILIATION",
      state: health.domains.reconciliation.state,
      persistent: recentReconciliationFailures >= 2,
      eligibleForIncident: false,
      reason: "EVALUATING",
      severity: severityFor(
        health.domains.reconciliation.state,
      ),
      score: health.domains.reconciliation.score,
      evidence: {
        recentFailedRuns: recentReconciliationFailures,
        latestRunId: reconciliationRuns[0]?.id ?? null,
        latestStatus: reconciliationRuns[0]?.status ?? null,
      },
    },
    {
      domain: "INCIDENT_AUTOMATION",
      state: health.domains.incidentAutomation.state,
      persistent: recentSlaFailures >= 2,
      eligibleForIncident: false,
      reason: "EVALUATING",
      severity: severityFor(
        health.domains.incidentAutomation.state,
      ),
      score: health.domains.incidentAutomation.score,
      evidence: {
        recentFailedRuns: recentSlaFailures,
        latestRunId: slaRuns[0]?.id ?? null,
        latestStatus: slaRuns[0]?.status ?? null,
      },
    },
    {
      domain: "NOTIFICATIONS",
      state: health.domains.notifications.state,
      persistent:
        openSloAlerts > 0 &&
        ["DEGRADED", "CRITICAL"].includes(
          health.domains.notifications.state,
        ),
      eligibleForIncident: false,
      reason: "EVALUATING",
      severity: severityFor(
        health.domains.notifications.state,
      ),
      score: health.domains.notifications.score,
      evidence: {
        openSloTrendAlerts: openSloAlerts,
        nocState: health.domains.notifications.state,
      },
    },
    {
      domain: "SLO",
      state: health.domains.slo.state,
      persistent:
        (
          openSloAlerts > 0 &&
          ["DEGRADED", "CRITICAL"].includes(
            health.domains.slo.state,
          )
        ) ||
        sloPressure,
      eligibleForIncident: false,
      reason: "EVALUATING",
      severity: severityFor(health.domains.slo.state),
      score: health.domains.slo.score,
      evidence: {
        openSloTrendAlerts: openSloAlerts,
        nocState: health.domains.slo.state,
        controlPlaneBurnRate,
        controlPlaneErrorBudget,
        controlPlaneBurnState,
        sloPressure,
        sloCriticalPressure,
        latestControlPlaneSloRunId:
          latestControlPlaneSloRun?.id ?? null,
      },
    },
  ];

  for (const decision of decisions) {
    if (decision.state === "HEALTHY") {
      decision.eligibleForIncident = false;
      decision.reason = "DOMAIN_HEALTHY";
      continue;
    }

    if (decision.state === "UNKNOWN") {
      decision.eligibleForIncident = false;
      decision.reason = "INSUFFICIENT_FRESH_EVIDENCE";
      continue;
    }

    if (!decision.persistent) {
      decision.eligibleForIncident = false;
      decision.reason = "PERSISTENCE_THRESHOLD_NOT_MET";
      continue;
    }

    decision.eligibleForIncident = true;

    if (
      sloCriticalPressure &&
      ["DISCOVERY", "PROXMOX", "SLO"].includes(decision.domain)
    ) {
      decision.reason = "CONTROL_PLANE_ERROR_BUDGET_CRITICAL";
    } else if (
      sloPressure &&
      ["DISCOVERY", "PROXMOX", "SLO"].includes(decision.domain)
    ) {
      decision.reason = "CONTROL_PLANE_BURN_RATE_DEGRADED";
    } else {
      decision.reason = "PERSISTENT_CONTROL_PLANE_DEGRADATION";
    }
  }

  return {
    version: "015.6.11.7.3.1",
    evaluatedAt: new Date(),
    controlPlane: {
      state: health.state,
      score: health.score,
      confidence: health.confidence,
      rootCauses: health.rootCauses,
      blockedCapabilities: health.blockedCapabilities,
      sloPressure: {
        burnRate: controlPlaneBurnRate,
        errorBudgetPercent: controlPlaneErrorBudget,
        burnState: controlPlaneBurnState,
        degraded: sloPressure,
        critical: sloCriticalPressure,
        latestRunId: latestControlPlaneSloRun?.id ?? null,
      },
    },
    policy: {
      discoveryConsecutiveFailures: 3,
      discoveryRecentFailureRuns: 3,
      reconciliationFailedRuns: 2,
      slaFailedRuns: 2,
      notificationOpenTrendAlerts: 1,
      controlPlaneBurnDegradedAt: 2,
      controlPlaneBurnCriticalAt: 10,
      errorBudgetExhaustedAt: 0,
      unknownFailClosed: true,
    },
    decisions,
  };
}

export async function reconcileSelfHealthIncidents(input: {
  organizationId: string;
  commit?: boolean;
}) {
  const evaluation = await evaluateSelfHealthIncidents(
    input.organizationId,
  );

  const commit = Boolean(input.commit);

  const result = {
    version: "015.6.11.7.3.1",
    mode: commit ? "COMMIT" : "DRY_RUN",
    opened: 0,
    updated: 0,
    resolved: 0,
    keptOpen: 0,
    actions: [] as Array<Record<string, unknown>>,
  };

  for (const decision of evaluation.decisions) {
    const asset = domainAsset(decision.domain);

    const existing = await prisma.infrastructureIncident.findFirst({
      where: {
        organizationId: input.organizationId,
        source: "HOIWORK_SELF_HEALTH",
        assetExternalId: asset.externalId,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
      orderBy: { firstSeenAt: "desc" },
    });

    if (decision.eligibleForIncident) {
      if (existing) {
        result.keptOpen += 1;

        if (commit) {
          await prisma.infrastructureIncident.update({
            where: { id: existing.id },
            data: {
              lastSeenAt: new Date(),
              severity: decision.severity,
              riskScore:
                decision.state === "CRITICAL" ? 90 : 70,
              metadata: {
                ...(existing.metadata &&
                typeof existing.metadata === "object" &&
                !Array.isArray(existing.metadata)
                  ? existing.metadata
                  : {}),
                selfHealthDomain: decision.domain,
                selfHealthState: decision.state,
                selfHealthReason: decision.reason,
                selfHealthScore: decision.score,
                selfHealthEvidence: decision.evidence,
                selfHealthLastEvaluatedAt:
                  evaluation.evaluatedAt.toISOString(),
                selfHealthVersion: evaluation.version,
              } as Prisma.InputJsonValue,
            },
          });

          result.updated += 1;
        }

        result.actions.push({
          domain: decision.domain,
          action: commit ? "UPDATED" : "WOULD_UPDATE",
          incidentId: existing.id,
          state: decision.state,
          reason: decision.reason,
        });

        continue;
      }

      const now = new Date();
      const externalId =
        `self-health/${decision.domain.toLowerCase()}/` +
        now.getTime();

      const fingerprint = sha256(
        [
          input.organizationId,
          asset.externalId,
          now.toISOString(),
          evaluation.version,
        ].join("|"),
      );

      if (commit) {
        const created = await prisma.$transaction(async (tx) => {
          const concurrent = await tx.infrastructureIncident.findFirst({
            where: {
              organizationId: input.organizationId,
              source: "HOIWORK_SELF_HEALTH",
              assetExternalId: asset.externalId,
              status: { in: ["OPEN", "ACKNOWLEDGED"] },
            },
          });

          if (concurrent) return concurrent;

          const incident = await tx.infrastructureIncident.create({
            data: {
              organizationId: input.organizationId,
              externalId,
              title:
                `Control Plane ${decision.domain} ` +
                `${decision.state}`,
              description:
                `Degradação persistente detectada no domínio ` +
                `${decision.domain} do HOIWORK Control Plane.`,
              source: "HOIWORK_SELF_HEALTH",
              status: "OPEN",
              severity: decision.severity,
              riskScore:
                decision.state === "CRITICAL" ? 90 : 70,
              assetExternalId: asset.externalId,
              assetName: asset.name,
              assetType: asset.type,
              blastRadius: 1,
              fingerprint,
              firstSeenAt: now,
              lastSeenAt: now,
              metadata: {
                selfHealthDomain: decision.domain,
                selfHealthState: decision.state,
                selfHealthReason: decision.reason,
                selfHealthScore: decision.score,
                selfHealthEvidence: decision.evidence,
                controlPlaneRootCauses:
                  evaluation.controlPlane.rootCauses,
                blockedCapabilities:
                  evaluation.controlPlane.blockedCapabilities,
                selfHealthVersion: evaluation.version,
              } as Prisma.InputJsonValue,
            },
          });

          await tx.infrastructureIncidentEvent.create({
            data: {
              organizationId: input.organizationId,
              incidentId: incident.id,
              eventType: "SELF_HEALTH_INCIDENT_OPENED",
              message:
                `Self-health incident aberto para ` +
                `${decision.domain} (${decision.state}).`,
              actorName: "HOIWORK",
              toStatus: "OPEN",
              metadata: {
                version: evaluation.version,
                domain: decision.domain,
                state: decision.state,
                score: decision.score,
                reason: decision.reason,
              } as Prisma.InputJsonValue,
            },
          });

          return incident;
        });

        result.actions.push({
          domain: decision.domain,
          action: "OPENED",
          incidentId: created.id,
          state: decision.state,
          reason: decision.reason,
        });
      } else {
        result.actions.push({
          domain: decision.domain,
          action: "WOULD_OPEN",
          state: decision.state,
          reason: decision.reason,
        });
      }

      result.opened += 1;
      continue;
    }

    if (
      existing &&
      decision.state === "HEALTHY"
    ) {
      if (commit) {
        const now = new Date();

        await prisma.$transaction(async (tx) => {
          await tx.infrastructureIncident.update({
            where: { id: existing.id },
            data: {
              status: "RESOLVED",
              resolvedAt: now,
              lastSeenAt: now,
              metadata: {
                ...(existing.metadata &&
                typeof existing.metadata === "object" &&
                !Array.isArray(existing.metadata)
                  ? existing.metadata
                  : {}),
                selfHealthResolvedBy:
                  "CONTROL_PLANE_RECOVERY",
                selfHealthResolvedAt: now.toISOString(),
                selfHealthVersion: evaluation.version,
              } as Prisma.InputJsonValue,
            },
          });

          await tx.infrastructureIncidentEvent.create({
            data: {
              organizationId: input.organizationId,
              incidentId: existing.id,
              eventType: "SELF_HEALTH_INCIDENT_RESOLVED",
              message:
                `Domínio ${decision.domain} recuperado e ` +
                `self-health incident resolvido.`,
              actorName: "HOIWORK",
              fromStatus: existing.status,
              toStatus: "RESOLVED",
              metadata: {
                version: evaluation.version,
                domain: decision.domain,
                state: decision.state,
              } as Prisma.InputJsonValue,
            },
          });
        });
      }

      result.resolved += 1;
      result.actions.push({
        domain: decision.domain,
        action: commit ? "RESOLVED" : "WOULD_RESOLVE",
        incidentId: existing.id,
        state: decision.state,
      });

      continue;
    }

    result.actions.push({
      domain: decision.domain,
      action: "NO_ACTION",
      state: decision.state,
      reason: decision.reason,
    });
  }

  return {
    evaluation,
    result,
  };
}
