import { buildControlPlaneHealth } from "@/lib/observability/control-plane-health";
import { buildControlPlaneSloReport } from "@/lib/observability/control-plane-slo-report";
import { evaluateSelfHealthIncidents } from "@/lib/incidents/self-health-incident-engine";

export type AutonomousActionDecision =
  | "AUTHORIZED"
  | "RESTRICTED"
  | "BLOCKED";

export type AutonomousCapability =
  | "DISCOVERY"
  | "INCIDENT_RECONCILIATION"
  | "NOTIFICATION_DISPATCH"
  | "REMEDIATION_SIMULATED"
  | "REMEDIATION_REAL"
  | "POST_REMEDIATION_VERIFICATION";

type CapabilityDecision = {
  capability: AutonomousCapability;
  decision: AutonomousActionDecision;
  reasons: string[];
};

function minDecision(
  a: AutonomousActionDecision,
  b: AutonomousActionDecision,
): AutonomousActionDecision {
  const rank: Record<AutonomousActionDecision, number> = {
    AUTHORIZED: 2,
    RESTRICTED: 1,
    BLOCKED: 0,
  };

  return rank[a] <= rank[b] ? a : b;
}

function capabilityFromBlockedCapability(
  blocked: string,
): AutonomousCapability[] {
  switch (blocked) {
    case "FULL_DISCOVERY":
      return ["DISCOVERY"];
    case "INCIDENT_RECONCILIATION":
      return ["INCIDENT_RECONCILIATION"];
    case "POST_CLOSURE_REGRESSION_GUARD":
      return ["POST_REMEDIATION_VERIFICATION"];
    default:
      return [];
  }
}

export async function evaluateAutonomousActionEligibility(
  organizationId: string,
) {
  const [health, slo, selfHealth] = await Promise.all([
    buildControlPlaneHealth(organizationId),
    buildControlPlaneSloReport(organizationId, 24),
    evaluateSelfHealthIncidents(organizationId),
  ]);

  const reasons: string[] = [];
  const blockers: string[] = [];
  const restrictions: string[] = [];

  let decision: AutonomousActionDecision = "AUTHORIZED";

  if (health.state === "CRITICAL") {
    decision = "BLOCKED";
    blockers.push("CONTROL_PLANE_CRITICAL");
  } else if (health.state === "UNKNOWN") {
    decision = "BLOCKED";
    blockers.push("CONTROL_PLANE_UNKNOWN");
  } else if (health.state === "DEGRADED") {
    decision = "RESTRICTED";
    restrictions.push("CONTROL_PLANE_DEGRADED");
  }

  if (health.confidence === "LOW") {
    decision = "BLOCKED";
    blockers.push("CONTROL_PLANE_CONFIDENCE_LOW");
  } else if (health.confidence === "MEDIUM") {
    decision = minDecision(decision, "RESTRICTED");
    restrictions.push("CONTROL_PLANE_CONFIDENCE_MEDIUM");
  }

  if (health.blockers.length > 0) {
    decision = "BLOCKED";
    blockers.push(...health.blockers.map((item) => `HEALTH_${item}`));
  }

  if (health.blockedCapabilities.length > 0) {
    reasons.push(
      ...health.blockedCapabilities.map(
        (item) => `CAPABILITY_BLOCKED_${item}`,
      ),
    );
  }

  if (slo.sampleCount === 0 || slo.availability === null) {
    decision = "BLOCKED";
    blockers.push("CONTROL_PLANE_SLO_NO_DATA");
  } else {
    if (slo.burnState === "CRITICAL") {
      decision = "BLOCKED";
      blockers.push("CONTROL_PLANE_BURN_RATE_CRITICAL");
    } else if (slo.burnState === "DEGRADED") {
      decision = minDecision(decision, "RESTRICTED");
      restrictions.push("CONTROL_PLANE_BURN_RATE_DEGRADED");
    }

    if (
      slo.errorBudgetPercent !== null &&
      slo.errorBudgetPercent <= 0
    ) {
      decision = "BLOCKED";
      blockers.push("CONTROL_PLANE_ERROR_BUDGET_EXHAUSTED");
    }
  }

  const activeSelfHealth = selfHealth.decisions.filter(
    (item) =>
      item.eligibleForIncident &&
      item.state !== "HEALTHY",
  );

  if (activeSelfHealth.some((item) => item.state === "CRITICAL")) {
    decision = "BLOCKED";
    blockers.push("ACTIVE_CRITICAL_SELF_HEALTH");
  } else if (activeSelfHealth.length > 0) {
    decision = minDecision(decision, "RESTRICTED");
    restrictions.push("ACTIVE_SELF_HEALTH_DEGRADATION");
  }

  const capabilities: CapabilityDecision[] = (
    [
      "DISCOVERY",
      "INCIDENT_RECONCILIATION",
      "NOTIFICATION_DISPATCH",
      "REMEDIATION_SIMULATED",
      "REMEDIATION_REAL",
      "POST_REMEDIATION_VERIFICATION",
    ] as AutonomousCapability[]
  ).map((capability) => ({
    capability,
    decision,
    reasons: [],
  }));

  for (const blocked of health.blockedCapabilities) {
    for (const capability of capabilityFromBlockedCapability(blocked)) {
      const entry = capabilities.find(
        (item) => item.capability === capability,
      );
      if (!entry) continue;

      entry.decision = "BLOCKED";
      entry.reasons.push(`BLOCKED_BY_${blocked}`);
    }
  }

  const real = capabilities.find(
    (item) => item.capability === "REMEDIATION_REAL",
  );

  if (real) {
    if (decision !== "AUTHORIZED") {
      real.decision = "BLOCKED";
      real.reasons.push("REAL_REMEDIATION_REQUIRES_GLOBAL_AUTHORIZED");
    }

    if (health.confidence !== "HIGH") {
      real.decision = "BLOCKED";
      real.reasons.push("REAL_REMEDIATION_REQUIRES_HIGH_CONFIDENCE");
    }

    if (slo.burnState !== "HEALTHY") {
      real.decision = "BLOCKED";
      real.reasons.push("REAL_REMEDIATION_REQUIRES_HEALTHY_BURN_STATE");
    }
  }

  const simulated = capabilities.find(
    (item) => item.capability === "REMEDIATION_SIMULATED",
  );

  if (simulated && decision === "BLOCKED") {
    simulated.decision = "RESTRICTED";
    simulated.reasons.push(
      "SIMULATED_MODE_REMAINS_AVAILABLE_FOR_DIAGNOSTICS",
    );
  }

  reasons.push(...blockers, ...restrictions);

  return {
    version: "015.6.11.7.4.1",
    evaluatedAt: new Date(),
    failClosed: true,
    decision,
    controlPlaneState: health.state,
    score: health.score,
    confidence: health.confidence,
    reasons: Array.from(new Set(reasons)),
    blockers: Array.from(new Set(blockers)),
    restrictions: Array.from(new Set(restrictions)),
    capabilities,
    evidence: {
      health: {
        state: health.state,
        score: health.score,
        confidence: health.confidence,
        blockers: health.blockers,
        warnings: health.warnings,
        blockedCapabilities: health.blockedCapabilities,
        recovery: health.recovery,
      },
      slo: {
        sampleCount: slo.sampleCount,
        availability: slo.availability,
        target: slo.target,
        errorBudgetPercent: slo.errorBudgetPercent,
        burnRate: slo.burnRate,
        burnState: slo.burnState,
      },
      selfHealth: {
        activeEligible: activeSelfHealth.map((item) => ({
          domain: item.domain,
          state: item.state,
          reason: item.reason,
          severity: item.severity,
        })),
      },
    },
  };
}
