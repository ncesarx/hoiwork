import { evaluateAutonomousActionEligibility } from "@/lib/governance/autonomous-action-eligibility";

export type GovernedCapability =
  | "DISCOVERY"
  | "INCIDENT_RECONCILIATION"
  | "NOTIFICATION_DISPATCH"
  | "REMEDIATION_SIMULATED"
  | "REMEDIATION_REAL"
  | "POST_REMEDIATION_VERIFICATION";

export type CapabilityGovernanceDecision =
  | "AUTHORIZED"
  | "RESTRICTED"
  | "BLOCKED";

type CapabilityPolicy = {
  capability: GovernedCapability;
  minimumConfidence: "HIGH" | "MEDIUM" | "LOW";
  requireHealthyControlPlane: boolean;
  maxBurnState: "HEALTHY" | "DEGRADED";
  requirePositiveErrorBudget: boolean;
  allowWhenSelfHealthActive: boolean;
  allowWhenGlobalRestricted: boolean;
  failClosed: boolean;
};

const CAPABILITY_POLICIES: Record<GovernedCapability, CapabilityPolicy> = {
  DISCOVERY: {
    capability: "DISCOVERY",
    minimumConfidence: "MEDIUM",
    requireHealthyControlPlane: false,
    maxBurnState: "DEGRADED",
    requirePositiveErrorBudget: false,
    allowWhenSelfHealthActive: true,
    allowWhenGlobalRestricted: true,
    failClosed: true,
  },
  INCIDENT_RECONCILIATION: {
    capability: "INCIDENT_RECONCILIATION",
    minimumConfidence: "HIGH",
    requireHealthyControlPlane: true,
    maxBurnState: "HEALTHY",
    requirePositiveErrorBudget: true,
    allowWhenSelfHealthActive: false,
    allowWhenGlobalRestricted: false,
    failClosed: true,
  },
  NOTIFICATION_DISPATCH: {
    capability: "NOTIFICATION_DISPATCH",
    minimumConfidence: "MEDIUM",
    requireHealthyControlPlane: false,
    maxBurnState: "DEGRADED",
    requirePositiveErrorBudget: false,
    allowWhenSelfHealthActive: true,
    allowWhenGlobalRestricted: true,
    failClosed: true,
  },
  REMEDIATION_SIMULATED: {
    capability: "REMEDIATION_SIMULATED",
    minimumConfidence: "MEDIUM",
    requireHealthyControlPlane: false,
    maxBurnState: "DEGRADED",
    requirePositiveErrorBudget: false,
    allowWhenSelfHealthActive: true,
    allowWhenGlobalRestricted: true,
    failClosed: true,
  },
  REMEDIATION_REAL: {
    capability: "REMEDIATION_REAL",
    minimumConfidence: "HIGH",
    requireHealthyControlPlane: true,
    maxBurnState: "HEALTHY",
    requirePositiveErrorBudget: true,
    allowWhenSelfHealthActive: false,
    allowWhenGlobalRestricted: false,
    failClosed: true,
  },
  POST_REMEDIATION_VERIFICATION: {
    capability: "POST_REMEDIATION_VERIFICATION",
    minimumConfidence: "HIGH",
    requireHealthyControlPlane: true,
    maxBurnState: "HEALTHY",
    requirePositiveErrorBudget: true,
    allowWhenSelfHealthActive: false,
    allowWhenGlobalRestricted: false,
    failClosed: true,
  },
};

const confidenceRank = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
} as const;

const burnRank = {
  HEALTHY: 0,
  DEGRADED: 1,
  CRITICAL: 2,
  NO_DATA: 3,
} as const;

function worse(
  a: CapabilityGovernanceDecision,
  b: CapabilityGovernanceDecision,
) {
  const rank = {
    AUTHORIZED: 2,
    RESTRICTED: 1,
    BLOCKED: 0,
  } as const;

  return rank[a] <= rank[b] ? a : b;
}

export async function evaluateCapabilityGovernanceMatrix(
  organizationId: string,
) {
  const eligibility =
    await evaluateAutonomousActionEligibility(organizationId);

  const selfHealthActive =
    eligibility.evidence.selfHealth.activeEligible.length > 0;

  const matrix = (
    Object.keys(CAPABILITY_POLICIES) as GovernedCapability[]
  ).map((capability) => {
    const policy = CAPABILITY_POLICIES[capability];
    const reasons: string[] = [];

    const eligibilityEntry = eligibility.capabilities.find(
      (item) => item.capability === capability,
    );

    let decision: CapabilityGovernanceDecision =
      eligibilityEntry?.decision ?? "BLOCKED";

    if (!eligibilityEntry) {
      reasons.push("ELIGIBILITY_CAPABILITY_MISSING");
      decision = "BLOCKED";
    }

    if (
      confidenceRank[eligibility.confidence] <
      confidenceRank[policy.minimumConfidence]
    ) {
      decision = "BLOCKED";
      reasons.push(
        `CONFIDENCE_BELOW_${policy.minimumConfidence}`,
      );
    }

    if (
      policy.requireHealthyControlPlane &&
      eligibility.controlPlaneState !== "HEALTHY"
    ) {
      decision = "BLOCKED";
      reasons.push("CONTROL_PLANE_NOT_HEALTHY");
    }

    const burnState =
      eligibility.evidence.slo.burnState ?? "NO_DATA";

    if (
      burnRank[burnState as keyof typeof burnRank] >
      burnRank[policy.maxBurnState]
    ) {
      decision = "BLOCKED";
      reasons.push(
        `BURN_STATE_EXCEEDS_${policy.maxBurnState}`,
      );
    }

    if (
      policy.requirePositiveErrorBudget &&
      (
        eligibility.evidence.slo.errorBudgetPercent === null ||
        eligibility.evidence.slo.errorBudgetPercent <= 0
      )
    ) {
      decision = "BLOCKED";
      reasons.push("ERROR_BUDGET_NOT_POSITIVE");
    }

    if (selfHealthActive && !policy.allowWhenSelfHealthActive) {
      decision = "BLOCKED";
      reasons.push("ACTIVE_SELF_HEALTH_NOT_ALLOWED");
    }

    if (
      eligibility.decision === "RESTRICTED" &&
      !policy.allowWhenGlobalRestricted
    ) {
      decision = "BLOCKED";
      reasons.push("GLOBAL_RESTRICTED_NOT_ALLOWED");
    } else if (
      eligibility.decision === "RESTRICTED" &&
      policy.allowWhenGlobalRestricted
    ) {
      decision = worse(decision, "RESTRICTED");
      reasons.push("GLOBAL_RESTRICTED_PROPAGATED");
    }

    if (eligibility.decision === "BLOCKED") {
      const controlPlaneAllowsDiagnostics =
        eligibility.controlPlaneState !== "CRITICAL" &&
        eligibility.controlPlaneState !== "UNKNOWN" &&
        confidenceRank[eligibility.confidence] >= confidenceRank.MEDIUM;

      const burnAllowsDiagnostics =
        burnRank[burnState as keyof typeof burnRank] <=
        burnRank.DEGRADED;

      const explicitlyBlockedByHealth =
        eligibilityEntry?.decision === "BLOCKED" &&
        (eligibilityEntry.reasons ?? []).some((reason) =>
          reason.startsWith("BLOCKED_BY_"),
        );

      if (
        (capability === "DISCOVERY" ||
          capability === "REMEDIATION_SIMULATED") &&
        controlPlaneAllowsDiagnostics &&
        burnAllowsDiagnostics &&
        !explicitlyBlockedByHealth
      ) {
        decision = "RESTRICTED";
        reasons.push("DIAGNOSTIC_CAPABILITY_PRESERVED");
      } else {
        decision = "BLOCKED";
        reasons.push("GLOBAL_BLOCK_PROPAGATED");
      }
    }

    reasons.push(...(eligibilityEntry?.reasons ?? []));

    return {
      capability,
      decision,
      failClosed: policy.failClosed,
      reasons: Array.from(new Set(reasons)),
      policy,
      evidence: {
        globalDecision: eligibility.decision,
        controlPlaneState: eligibility.controlPlaneState,
        confidence: eligibility.confidence,
        availability: eligibility.evidence.slo.availability,
        errorBudgetPercent:
          eligibility.evidence.slo.errorBudgetPercent,
        burnRate: eligibility.evidence.slo.burnRate,
        burnState: eligibility.evidence.slo.burnState,
        selfHealthActive,
      },
    };
  });

  const summary = {
    authorized: matrix.filter((item) => item.decision === "AUTHORIZED").length,
    restricted: matrix.filter((item) => item.decision === "RESTRICTED").length,
    blocked: matrix.filter((item) => item.decision === "BLOCKED").length,
  };

  return {
    version: "015.6.11.7.4.2",
    evaluatedAt: new Date(),
    failClosed: true,
    globalDecision: eligibility.decision,
    summary,
    matrix,
    sourceEligibility: {
      version: eligibility.version,
      decision: eligibility.decision,
      controlPlaneState: eligibility.controlPlaneState,
      score: eligibility.score,
      confidence: eligibility.confidence,
      blockers: eligibility.blockers,
      restrictions: eligibility.restrictions,
    },
  };
}
