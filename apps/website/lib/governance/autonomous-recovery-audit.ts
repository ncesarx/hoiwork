import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  evaluateCapabilityGovernanceMatrix,
  type GovernedCapability,
  type CapabilityGovernanceDecision,
} from "@/lib/governance/capability-governance-matrix";
import { evaluateRecentRecoveryEvidence } from "@/lib/governance/recent-recovery-evidence";

type EffectiveDecision = CapabilityGovernanceDecision;

const RECOVERY_FROM_BLOCKED_REQUIRED = 3;
const RECOVERY_FROM_RESTRICTED_REQUIRED = 2;
const RELAX_BLOCKED_TO_RESTRICTED_REQUIRED = 2;

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function transitionEvent(
  previous: EffectiveDecision | null,
  next: EffectiveDecision,
) {
  if (previous === null) {
    return next === "AUTHORIZED"
      ? "ALLOW"
      : next === "RESTRICTED"
        ? "RESTRICT"
        : "BLOCK";
  }

  if (previous === next) return "NO_CHANGE";

  if (next === "BLOCKED") return "BLOCK";
  if (next === "RESTRICTED") {
    return previous === "BLOCKED" ? "RECOVER" : "RESTRICT";
  }

  return "RECOVER";
}

export async function reconcileAutonomousGovernanceState(input: {
  organizationId: string;
  source?: "MANUAL" | "SCHEDULER";
  commit?: boolean;
}) {
  const source = input.source ?? "MANUAL";
  const commit = Boolean(input.commit);
  const [matrix, recentRecovery] = await Promise.all([
    evaluateCapabilityGovernanceMatrix(input.organizationId),
    evaluateRecentRecoveryEvidence(input.organizationId),
  ]);
  const now = new Date();

  const currentStates = await prisma.autonomousCapabilityGovernanceState.findMany({
    where: { organizationId: input.organizationId },
  });

  const currentByCapability = new Map(
    currentStates.map((item) => [item.capability, item]),
  );

  const actions: Array<Record<string, unknown>> = [];

  for (const candidate of matrix.matrix) {
    const capability = candidate.capability as GovernedCapability;
    const current = currentByCapability.get(capability);

    const recoveryOverrideEligible =
    recentRecovery.eligible &&
    candidate.decision === "BLOCKED";

    const recoveryCandidateDecision: CapabilityGovernanceDecision =
      recoveryOverrideEligible
        ? "AUTHORIZED"
        : candidate.decision;
    const previous = (current?.effectiveDecision ??
      null) as EffectiveDecision | null;

    let effective: EffectiveDecision = previous ?? candidate.decision;
    let consecutiveAuthorized =
      current?.consecutiveAuthorized ?? 0;
    let consecutiveRestricted =
      current?.consecutiveRestricted ?? 0;
    let consecutiveBlocked =
      current?.consecutiveBlocked ?? 0;

    if (recoveryCandidateDecision === "BLOCKED") {
      effective = "BLOCKED";
      consecutiveBlocked += 1;
      consecutiveRestricted = 0;
      consecutiveAuthorized = 0;
    } else if (recoveryCandidateDecision === "RESTRICTED") {
      consecutiveRestricted += 1;
      consecutiveBlocked = 0;
      consecutiveAuthorized = 0;

      if (previous === "BLOCKED") {
        if (
          consecutiveRestricted >=
          RELAX_BLOCKED_TO_RESTRICTED_REQUIRED
        ) {
          effective = "RESTRICTED";
        } else {
          effective = "BLOCKED";
        }
      } else {
        effective = "RESTRICTED";
      }
    } else {
      consecutiveAuthorized += 1;
      consecutiveRestricted = 0;
      consecutiveBlocked = 0;

      if (previous === "BLOCKED") {
        effective =
          consecutiveAuthorized >=
          RECOVERY_FROM_BLOCKED_REQUIRED
            ? "AUTHORIZED"
            : "BLOCKED";
      } else if (previous === "RESTRICTED") {
        effective =
          consecutiveAuthorized >=
          RECOVERY_FROM_RESTRICTED_REQUIRED
            ? "AUTHORIZED"
            : "RESTRICTED";
      } else {
        effective = "AUTHORIZED";
      }
    }

    const eventType = transitionEvent(previous, effective);
    const changed = previous !== effective;

    const stateData = {
      candidateDecision: recoveryCandidateDecision,
      effectiveDecision: effective,
      consecutiveAuthorized,
      consecutiveRestricted,
      consecutiveBlocked,
      lastEvaluatedAt: now,
      lastCandidateAt: now,
      lastTransitionAt: changed
        ? now
        : current?.lastTransitionAt ?? null,
      recoveredAt:
        changed &&
        previous !== null &&
        previous !== "AUTHORIZED" &&
        effective === "AUTHORIZED"
          ? now
          : current?.recoveredAt ?? null,
      reasons: json(candidate.reasons),
      evidence: json({
        version: "015.6.11.7.4.4",
        matrixVersion: matrix.version,
        globalDecision: matrix.globalDecision,
        policy: candidate.policy,
        evidence: candidate.evidence,
      }),
    };

    if (commit) {
      const saved = await prisma.autonomousCapabilityGovernanceState.upsert({
        where: {
          organizationId_capability: {
            organizationId: input.organizationId,
            capability,
          },
        },
        update: stateData,
        create: {
          organizationId: input.organizationId,
          capability,
          ...stateData,
        },
      });

      await prisma.autonomousGovernanceAudit.create({
        data: {
          organizationId: input.organizationId,
          capability,
          source,
          eventType,
          candidateDecision: recoveryCandidateDecision,
          previousDecision: previous,
          effectiveDecision: effective,
          changed,
          reasons: json(candidate.reasons),
          metadata: json({
            stateId: saved.id,
            version: "015.6.11.7.4.4",
            globalDecision: matrix.globalDecision,
            consecutiveAuthorized,
            consecutiveRestricted,
            consecutiveBlocked,
          }),
        },
      });
    }

    actions.push({
      capability,
      previousDecision: previous,
      matrixCandidateDecision: candidate.decision,
      candidateDecision: recoveryCandidateDecision,
      recoveryOverrideEligible,
      effectiveDecision: effective,
      eventType,
      changed,
      consecutiveAuthorized,
      consecutiveRestricted,
      consecutiveBlocked,
      recoveryGate: {
        fromBlockedRequired: RECOVERY_FROM_BLOCKED_REQUIRED,
        fromRestrictedRequired:
          RECOVERY_FROM_RESTRICTED_REQUIRED,
        blockedToRestrictedRequired:
          RELAX_BLOCKED_TO_RESTRICTED_REQUIRED,
      },
      reasons: candidate.reasons,
    });
  }

  return {
    version: "015.6.11.7.4.4",
    evaluatedAt: now,
    mode: commit ? "COMMIT" : "DRY_RUN",
    source,
    asymmetricHysteresis: true,
    policy: {
      degradeImmediately: true,
      recoverFromBlockedAfter:
        RECOVERY_FROM_BLOCKED_REQUIRED,
      recoverFromRestrictedAfter:
        RECOVERY_FROM_RESTRICTED_REQUIRED,
      relaxBlockedToRestrictedAfter:
        RELAX_BLOCKED_TO_RESTRICTED_REQUIRED,
    },
    globalCandidateDecision:
      recentRecovery.eligible &&
      actions.every(
        (action) =>
          action.candidateDecision === "AUTHORIZED",
      )
        ? "AUTHORIZED"
        : matrix.globalDecision,
    recentRecovery,
    actions,
  };
}

export async function getAutonomousGovernanceStatus(
  organizationId: string,
) {
  const [states, audit] = await Promise.all([
    prisma.autonomousCapabilityGovernanceState.findMany({
      where: { organizationId },
      orderBy: { capability: "asc" },
    }),
    prisma.autonomousGovernanceAudit.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return {
    version: "015.6.11.7.4.4",
    states,
    audit,
  };
}
