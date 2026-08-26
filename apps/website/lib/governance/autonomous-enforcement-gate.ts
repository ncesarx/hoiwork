import { prisma } from "@/lib/prisma";
import { evaluateCapabilityGovernanceMatrix } from "@/lib/governance/capability-governance-matrix";
import { evaluateRecentRecoveryEvidence } from "@/lib/governance/recent-recovery-evidence";

export type EnforcementCapability =
  | "DISCOVERY"
  | "INCIDENT_RECONCILIATION"
  | "NOTIFICATION_DISPATCH"
  | "REMEDIATION_SIMULATED"
  | "REMEDIATION_REAL"
  | "POST_REMEDIATION_VERIFICATION";

type EnforcementDecision = "AUTHORIZED" | "RESTRICTED" | "BLOCKED";

const VERSION = "015.6.11.7.4.4.4";
const RECOVERY_FROM_BLOCKED_REQUIRED = 3;
const MAX_EFFECTIVE_STATE_AGE_MS = 15 * 60 * 1000;

function envTrue(name: string, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return defaultValue;

  return ["1", "true", "yes", "on"].includes(
    raw.trim().toLowerCase(),
  );
}

function ageMinutes(date: Date | null | undefined, now: Date) {
  if (!date) return null;

  return Math.max(
    0,
    (now.getTime() - date.getTime()) / 60_000,
  );
}

export class AutonomousGovernanceEnforcementError extends Error {
  readonly capability: EnforcementCapability;
  readonly decision: EnforcementDecision;
  readonly reasons: string[];

  constructor(input: {
    capability: EnforcementCapability;
    decision: EnforcementDecision;
    reasons: string[];
  }) {
    super(
      `Autonomous Governance bloqueou ${input.capability}: ${input.decision}` +
        (input.reasons.length
          ? ` (${input.reasons.join(", ")})`
          : ""),
    );

    this.name = "AutonomousGovernanceEnforcementError";
    this.capability = input.capability;
    this.decision = input.decision;
    this.reasons = input.reasons;
  }
}

export async function evaluateCapabilityEnforcement(input: {
  organizationId: string;
  capability: EnforcementCapability;
}) {
  const enforcementEnabled = envTrue(
    "HOIWORK_AUTONOMOUS_GOVERNANCE_ENFORCEMENT_ENABLED",
    false,
  );

  try {
    const [matrix, recentRecovery, persistedState] =
      await Promise.all([
        evaluateCapabilityGovernanceMatrix(
          input.organizationId,
        ),

        evaluateRecentRecoveryEvidence(
          input.organizationId,
        ),

        prisma.autonomousCapabilityGovernanceState.findUnique({
          where: {
            organizationId_capability: {
              organizationId: input.organizationId,
              capability: input.capability,
            },
          },
        }),
      ]);

    const capability = matrix.matrix.find(
      (item) => item.capability === input.capability,
    );

    if (!capability) {
      return {
        version: VERSION,
        enforcementEnabled,
        mode: enforcementEnabled ? "ENFORCE" : "SHADOW",
        capability: input.capability,
        decision: "BLOCKED" as const,
        allowed: !enforcementEnabled,
        wouldBlock: true,
        failClosed: true,
        decisionSource: "FAIL_CLOSED" as const,
        reasons: ["CAPABILITY_NOT_FOUND"],
        matrixVersion: matrix.version,
        globalDecision: matrix.globalDecision,
      };
    }

    /*
     * Fast path:
     *
     * Se a Matrix já autoriza a capability, não precisamos
     * utilizar o recovery override.
     */
    if (capability.decision === "AUTHORIZED") {
      return {
        version: VERSION,
        enforcementEnabled,
        mode: enforcementEnabled ? "ENFORCE" : "SHADOW",
        capability: input.capability,
        decision: "AUTHORIZED" as const,
        allowed: true,
        wouldBlock: false,
        failClosed: true,
        decisionSource: "CAPABILITY_MATRIX" as const,
        reasons: capability.reasons,
        matrixDecision: capability.decision,
        effectiveDecision:
          persistedState?.effectiveDecision ?? null,
        matrixVersion: matrix.version,
        globalDecision: matrix.globalDecision,
        evidence: capability.evidence,
      };
    }

    /*
     * Recovery convergence.
     *
     * Uma Matrix BLOCKED/RESTRICTED somente pode ser
     * superada quando a recuperação já atravessou a
     * hysteresis e existe evidência operacional recente.
     */

    const now = new Date();

    const stateAgeMs = persistedState
      ? now.getTime() - persistedState.lastEvaluatedAt.getTime()
      : Number.POSITIVE_INFINITY;

    const effectiveStateFresh =
      Boolean(persistedState) &&
      stateAgeMs >= 0 &&
      stateAgeMs <= MAX_EFFECTIVE_STATE_AGE_MS;

    const effectiveAuthorized =
      persistedState?.effectiveDecision === "AUTHORIZED";

    const candidateAuthorized =
      persistedState?.candidateDecision === "AUTHORIZED";

    const hysteresisSatisfied =
      (persistedState?.consecutiveAuthorized ?? 0) >=
      RECOVERY_FROM_BLOCKED_REQUIRED;

    const recoveryEligible =
      recentRecovery.eligible &&
      effectiveStateFresh &&
      effectiveAuthorized &&
      candidateAuthorized &&
      hysteresisSatisfied;

    if (recoveryEligible) {
      return {
        version: VERSION,
        enforcementEnabled,
        mode: enforcementEnabled ? "ENFORCE" : "SHADOW",
        capability: input.capability,
        decision: "AUTHORIZED" as const,
        allowed: true,
        wouldBlock: false,
        failClosed: true,

        decisionSource:
          "EFFECTIVE_RECOVERY_STATE" as const,

        reasons: [
          "RECOVERY_HYSTERESIS_SATISFIED",
          "RECENT_RECOVERY_EVIDENCE_ELIGIBLE",
          "EFFECTIVE_GOVERNANCE_STATE_AUTHORIZED",
        ],

        matrixDecision: capability.decision,
        effectiveDecision:
          persistedState?.effectiveDecision ?? null,

        matrixVersion: matrix.version,
        globalDecision: matrix.globalDecision,

        recovery: {
          eligible: recentRecovery.eligible,
          semanticVersion:
            recentRecovery.semanticVersion,
          requiredSamples:
            recentRecovery.requiredSamples,
          sampleCount:
            recentRecovery.sampleCount,

          effectiveStateFresh,
          effectiveStateAgeMinutes: ageMinutes(
            persistedState?.lastEvaluatedAt,
            now,
          ),

          consecutiveAuthorized:
            persistedState?.consecutiveAuthorized ?? 0,

          recoveredAt:
            persistedState?.recoveredAt ?? null,
        },

        evidence: capability.evidence,
      };
    }

    /*
     * Fail closed.
     *
     * Persistência antiga, janela de recovery inválida,
     * hysteresis incompleta ou qualquer outra ausência
     * de evidência não pode liberar a capability.
     */

    const recoveryFailureReasons: string[] = [];

    if (!recentRecovery.eligible) {
      recoveryFailureReasons.push(
        "RECENT_RECOVERY_EVIDENCE_NOT_ELIGIBLE",
      );
    }

    if (!persistedState) {
      recoveryFailureReasons.push(
        "EFFECTIVE_GOVERNANCE_STATE_NOT_FOUND",
      );
    } else {
      if (!effectiveStateFresh) {
        recoveryFailureReasons.push(
          "EFFECTIVE_GOVERNANCE_STATE_STALE",
        );
      }

      if (!effectiveAuthorized) {
        recoveryFailureReasons.push(
          "EFFECTIVE_GOVERNANCE_STATE_NOT_AUTHORIZED",
        );
      }

      if (!candidateAuthorized) {
        recoveryFailureReasons.push(
          "RECOVERY_CANDIDATE_NOT_AUTHORIZED",
        );
      }

      if (!hysteresisSatisfied) {
        recoveryFailureReasons.push(
          "RECOVERY_HYSTERESIS_NOT_SATISFIED",
        );
      }
    }

    const decision = capability.decision as EnforcementDecision;

    return {
      version: VERSION,
      enforcementEnabled,
      mode: enforcementEnabled ? "ENFORCE" : "SHADOW",
      capability: input.capability,
      decision,
      allowed: enforcementEnabled ? false : true,
      wouldBlock: true,
      failClosed: true,
      decisionSource: "CAPABILITY_MATRIX" as const,

      reasons: [
        ...capability.reasons,
        ...recoveryFailureReasons,
      ],

      matrixDecision: capability.decision,
      effectiveDecision:
        persistedState?.effectiveDecision ?? null,

      matrixVersion: matrix.version,
      globalDecision: matrix.globalDecision,

      recovery: {
        eligible: recentRecovery.eligible,
        semanticVersion:
          recentRecovery.semanticVersion,
        requiredSamples:
          recentRecovery.requiredSamples,
        sampleCount:
          recentRecovery.sampleCount,

        effectiveStateFresh,
        effectiveStateAgeMinutes: ageMinutes(
          persistedState?.lastEvaluatedAt,
          now,
        ),

        consecutiveAuthorized:
          persistedState?.consecutiveAuthorized ?? 0,

        recoveredAt:
          persistedState?.recoveredAt ?? null,
      },

      evidence: capability.evidence,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Falha desconhecida ao avaliar governança autônoma.";

    return {
      version: VERSION,
      enforcementEnabled,
      mode: enforcementEnabled ? "ENFORCE" : "SHADOW",
      capability: input.capability,
      decision: "BLOCKED" as const,
      allowed: !enforcementEnabled,
      wouldBlock: true,
      failClosed: true,
      decisionSource: "FAIL_CLOSED" as const,
      reasons: [
        "GOVERNANCE_EVALUATION_FAILED",
        message,
      ],
      matrixVersion: null,
      globalDecision: "BLOCKED" as const,
    };
  }
}

export async function assertCapabilityEnforcement(input: {
  organizationId: string;
  capability: EnforcementCapability;
}) {
  const result = await evaluateCapabilityEnforcement(input);

  if (!result.allowed) {
    throw new AutonomousGovernanceEnforcementError({
      capability: input.capability,
      decision: result.decision,
      reasons: result.reasons,
    });
  }

  return result;
}
