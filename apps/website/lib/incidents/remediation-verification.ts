import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SessionLike = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
};

function actor(session: SessionLike) {
  return {
    id: session.user.id,
    name: session.user.name ?? session.user.email ?? "Operador",
  };
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function expectedStateFor(action: string, mode: string) {
  if (mode === "SIMULATED") return "UNCHANGED";

  switch (action) {
    case "START_VM":
      return "RUNNING";
    default:
      return "UNCHANGED";
  }
}

function rollbackAssessment(input: {
  action: string;
  mode: string;
  executionStatus: string;
  mutationPerformed: boolean;
  rollbackPlan: Prisma.JsonValue | null;
}) {
  const hasRollbackPlan =
    Array.isArray(input.rollbackPlan) && input.rollbackPlan.length > 0;

  if (input.mode === "SIMULATED" && input.mutationPerformed === false) {
    return {
      readiness: "NOT_REQUIRED",
      reason:
        "Execução simulada não realizou mutação real; rollback não é necessário.",
      hasRollbackPlan,
      executable: false,
    };
  }

  if (input.executionStatus !== "COMPLETED") {
    return {
      readiness: "BLOCKED",
      reason:
        "Não há execução concluída suficiente para avaliar rollback com segurança.",
      hasRollbackPlan,
      executable: false,
    };
  }

  if (!hasRollbackPlan) {
    return {
      readiness: "NOT_READY",
      reason: "Plano não possui estratégia de rollback registrada.",
      hasRollbackPlan: false,
      executable: false,
    };
  }

  return {
    readiness: "READY_FOR_REVIEW",
    reason:
      "Existe estratégia de rollback registrada, mas execução permanece dependente de revisão humana.",
    hasRollbackPlan: true,
    executable: false,
  };
}

export async function verifyRemediationPlan(input: {
  organizationId: string;
  incidentId: string;
  planId: string;
  session: SessionLike;
}) {
  const plan = await prisma.remediationExecutionPlan.findFirst({
    where: {
      id: input.planId,
      organizationId: input.organizationId,
      incidentId: input.incidentId,
    },
  });

  if (!plan) throw new Error("Plano não encontrado.");

  const execution = await prisma.remediationExecutionRun.findFirst({
    where: {
      organizationId: input.organizationId,
      incidentId: input.incidentId,
      planId: input.planId,
      status: "COMPLETED",
    },
    orderBy: { startedAt: "desc" },
  });

  if (!execution) {
    throw new Error("Nenhuma execução COMPLETED encontrada para este plano.");
  }

  const existing = await prisma.remediationVerificationRun.findFirst({
    where: {
      organizationId: input.organizationId,
      incidentId: input.incidentId,
      planId: input.planId,
      executionRunId: execution.id,
      status: "COMPLETED",
    },
    orderBy: { startedAt: "desc" },
  });

  if (existing) {
    return { reused: true, verification: existing };
  }

  const incident = await prisma.infrastructureIncident.findFirst({
    where: {
      id: input.incidentId,
      organizationId: input.organizationId,
    },
  });

  if (!incident) throw new Error("Incidente não encontrado.");

  const asset = await prisma.infrastructureAsset.findFirst({
    where: {
      organizationId: input.organizationId,
      externalId: incident.assetExternalId,
    },
    orderBy: { lastSeenAt: "desc" },
  });

  const resultObject =
    execution.result &&
    typeof execution.result === "object" &&
    !Array.isArray(execution.result)
      ? (execution.result as Record<string, Prisma.JsonValue>)
      : {};

  const mutationPerformed = resultObject.mutationPerformed === true;
  const expectedState = expectedStateFor(plan.action, execution.mode);
  const observedState = asset?.status ?? "NO_DATA";

  const checks = [
    {
      key: "EXECUTION_COMPLETED",
      ok: execution.status === "COMPLETED",
      detail: execution.status,
    },
    {
      key: "SIMULATION_DID_NOT_MUTATE",
      ok: execution.mode !== "SIMULATED" || mutationPerformed === false,
      detail: `mutationPerformed=${mutationPerformed}`,
    },
    {
      key: "ASSET_OBSERVED",
      ok: Boolean(asset),
      detail: asset ? `${asset.assetType}:${asset.status}` : "NO_DATA",
    },
    {
      key: "INCIDENT_STILL_TRACEABLE",
      ok: Boolean(incident.id),
      detail: `${incident.status}:${incident.severity}`,
    },
  ];

  const checksPassed = checks.every((check) => check.ok);

  let verificationState: string;

  if (execution.mode === "SIMULATED") {
    verificationState = checksPassed
      ? "SIMULATION_VERIFIED"
      : "SIMULATION_INCONCLUSIVE";
  } else if (observedState === expectedState) {
    verificationState = "VERIFIED";
  } else {
    verificationState = "NOT_VERIFIED";
  }

  const rollback = rollbackAssessment({
    action: plan.action,
    mode: execution.mode,
    executionStatus: execution.status,
    mutationPerformed,
    rollbackPlan: plan.rollbackPlan,
  });

  const who = actor(input.session);
  const startedAt = new Date();

  const verification = await prisma.$transaction(async (tx) => {
    const created = await tx.remediationVerificationRun.create({
      data: {
        organizationId: input.organizationId,
        incidentId: input.incidentId,
        planId: input.planId,
        executionRunId: execution.id,
        mode: execution.mode,
        status: "COMPLETED",
        verificationState,
        rollbackReadiness: rollback.readiness,
        expectedState,
        observedState,
        evidence: json({
          assetId: asset?.id ?? null,
          assetExternalId: incident.assetExternalId,
          assetStatus: asset?.status ?? null,
          assetLastSeenAt: asset?.lastSeenAt?.toISOString() ?? null,
          incidentStatus: incident.status,
          incidentSeverity: incident.severity,
          executionRunId: execution.id,
          executionMode: execution.mode,
          mutationPerformed,
        }),
        checks: json(checks),
        rollbackAssessment: json(rollback),
        startedAt,
        finishedAt: new Date(),
        durationMs: 0,
        createdById: who.id,
        createdByName: who.name,
      },
    });

    await tx.infrastructureIncidentEvent.create({
      data: {
        organizationId: input.organizationId,
        incidentId: input.incidentId,
        eventType: "REMEDIATION_VERIFIED",
        message:
          execution.mode === "SIMULATED"
            ? `Execução ${plan.action} verificada em modo SIMULATED. Nenhuma mutação real confirmada.`
            : `Execução ${plan.action} passou por verificação pós-execução.`,
        actorUserId: who.id,
        actorName: who.name,
        metadata: json({
          planId: plan.id,
          executionRunId: execution.id,
          verificationRunId: created.id,
          verificationState,
          rollbackReadiness: rollback.readiness,
          version: "015.6.11.5.4",
        }),
      },
    });

    return created;
  });

  return {
    reused: false,
    verification,
  };
}
