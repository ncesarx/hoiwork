import { prisma } from "@/lib/prisma";

export const REMEDIATION_CYCLE_POLICY_VERSION = "015.6.11.6.3.2";

export class RemediationCycleMismatchError extends Error {
  readonly code = "INCIDENT_CYCLE_MISMATCH";

  constructor(message: string) {
    super(message);
    this.name = "RemediationCycleMismatchError";
  }
}

export async function assertRemediationCycleIntegrity(input: {
  organizationId: string;
  incidentId: string;
  planId: string;
  governanceId?: string | null;
  authorizationId?: string | null;
}) {
  const plan = await prisma.remediationExecutionPlan.findFirst({
    where: {
      id: input.planId,
      organizationId: input.organizationId,
      incidentId: input.incidentId,
    },
    select: {
      id: true,
      incidentId: true,
      organizationId: true,
    },
  });

  if (!plan) {
    throw new RemediationCycleMismatchError(
      "Plano não pertence ao ciclo atual do incidente.",
    );
  }

  if (input.governanceId) {
    const governance =
      await prisma.remediationGovernanceEvaluation.findFirst({
        where: {
          id: input.governanceId,
          organizationId: input.organizationId,
          incidentId: input.incidentId,
          planId: input.planId,
        },
        select: {
          id: true,
        },
      });

    if (!governance) {
      throw new RemediationCycleMismatchError(
        "Governança não pertence ao ciclo atual do incidente/plano.",
      );
    }
  }

  if (input.authorizationId) {
    const authorization =
      await prisma.remediationExecutionAuthorization.findFirst({
        where: {
          id: input.authorizationId,
          organizationId: input.organizationId,
          incidentId: input.incidentId,
          planId: input.planId,
          ...(input.governanceId
            ? { governanceId: input.governanceId }
            : {}),
        },
        select: {
          id: true,
        },
      });

    if (!authorization) {
      throw new RemediationCycleMismatchError(
        "Autorização não pertence ao ciclo atual do incidente/plano.",
      );
    }
  }

  return {
    valid: true as const,
    policyVersion: REMEDIATION_CYCLE_POLICY_VERSION,
    incidentId: input.incidentId,
    planId: input.planId,
    governanceId: input.governanceId ?? null,
    authorizationId: input.authorizationId ?? null,
  };
}
