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

function preconditionsFor(plan: {
  status: string;
  realExecutionEnabled: boolean;
  executableNow: boolean;
  expiresAt: Date | null;
  action: string;
}) {
  const now = new Date();
  const checks = [
    {
      key: "PLAN_APPROVED",
      ok: plan.status === "APPROVED",
      detail: `status=${plan.status}`,
    },
    {
      key: "PLAN_NOT_EXPIRED",
      ok: !plan.expiresAt || plan.expiresAt > now,
      detail: plan.expiresAt ? plan.expiresAt.toISOString() : "no-expiration",
    },
    {
      key: "REAL_EXECUTION_DISABLED",
      ok: plan.realExecutionEnabled === false,
      detail: `realExecutionEnabled=${plan.realExecutionEnabled}`,
    },
    {
      key: "EXECUTABLE_NOW_FALSE",
      ok: plan.executableNow === false,
      detail: `executableNow=${plan.executableNow}`,
    },
    {
      key: "SUPPORTED_SIMULATION_ACTION",
      ok: [
        "START_VM",
        "INVESTIGATE_VM",
        "INVESTIGATE_NODE",
        "INVESTIGATE_NETWORK",
        "VERIFY_CONNECTIVITY",
        "COLLECT_EVIDENCE",
      ].includes(plan.action),
      detail: `action=${plan.action}`,
    },
  ];

  return {
    checks,
    passed: checks.every((check) => check.ok),
  };
}

function simulatedResult(action: string) {
  switch (action) {
    case "START_VM":
      return {
        simulated: true,
        executor: "PROXMOX_START_VM_SIMULATOR",
        wouldCall: "POST /nodes/{node}/qemu/{vmid}/status/start",
        mutationPerformed: false,
        expectedPostState: "RUNNING",
        verificationRequired: true,
      };
    case "INVESTIGATE_VM":
      return {
        simulated: true,
        executor: "VM_DIAGNOSTIC_SIMULATOR",
        wouldCall: "READ_ONLY_DIAGNOSTIC",
        mutationPerformed: false,
        expectedPostState: "UNCHANGED",
        verificationRequired: true,
      };
    case "INVESTIGATE_NODE":
      return {
        simulated: true,
        executor: "NODE_DIAGNOSTIC_SIMULATOR",
        wouldCall: "READ_ONLY_DIAGNOSTIC",
        mutationPerformed: false,
        expectedPostState: "UNCHANGED",
        verificationRequired: true,
      };
    case "INVESTIGATE_NETWORK":
      return {
        simulated: true,
        executor: "NETWORK_DIAGNOSTIC_SIMULATOR",
        wouldCall: "READ_ONLY_DIAGNOSTIC",
        mutationPerformed: false,
        expectedPostState: "UNCHANGED",
        verificationRequired: true,
      };
    case "VERIFY_CONNECTIVITY":
      return {
        simulated: true,
        executor: "CONNECTIVITY_CHECK_SIMULATOR",
        wouldCall: "READ_ONLY_CONNECTIVITY_CHECK",
        mutationPerformed: false,
        expectedPostState: "UNCHANGED",
        verificationRequired: true,
      };
    case "COLLECT_EVIDENCE":
      return {
        simulated: true,
        executor: "RECOVERY_EVIDENCE_SIMULATOR",
        wouldCall: "READ_ONLY_DISCOVERY_EVIDENCE",
        mutationPerformed: false,
        expectedPostState: "UNCHANGED",
        verificationRequired: true,
      };
    default:
      return {
        simulated: true,
        executor: "NOOP_SIMULATOR",
        wouldCall: "NONE",
        mutationPerformed: false,
        expectedPostState: "UNCHANGED",
        verificationRequired: false,
      };
  }
}

export async function executePlanSimulated(input: {
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

  const who = actor(input.session);
  const preconditions = preconditionsFor(plan);

  if (!preconditions.passed) {
    throw new Error(
      `Preconditions falharam: ${preconditions.checks
        .filter((check) => !check.ok)
        .map((check) => check.key)
        .join(", ")}`,
    );
  }

  const active = await prisma.remediationExecutionRun.findFirst({
    where: {
      organizationId: input.organizationId,
      planId: plan.id,
      mode: "SIMULATED",
      status: { in: ["RUNNING", "COMPLETED"] },
    },
    orderBy: { startedAt: "desc" },
  });

  if (active?.status === "COMPLETED") {
    return { reused: true, run: active };
  }

  const startedAt = new Date();

  const run = await prisma.remediationExecutionRun.create({
    data: {
      organizationId: input.organizationId,
      incidentId: input.incidentId,
      planId: plan.id,
      mode: "SIMULATED",
      status: "RUNNING",
      executor: `SIMULATED:${plan.action}`,
      request: json({
        action: plan.action,
        safetyClass: plan.safetyClass,
        risk: plan.risk,
        planStatus: plan.status,
      }),
      preconditions: json(preconditions),
      createdById: who.id,
      createdByName: who.name,
      startedAt,
    },
  });

  try {
    const result = simulatedResult(plan.action);
    const finishedAt = new Date();

    const completed = await prisma.$transaction(async (tx) => {
      const updatedRun = await tx.remediationExecutionRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          result: json(result),
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        },
      });

      await tx.infrastructureIncidentEvent.create({
        data: {
          organizationId: input.organizationId,
          incidentId: input.incidentId,
          eventType: "REMEDIATION_SIMULATED",
          message: `Plano ${plan.action} executado em modo SIMULATED. Nenhuma mutação real realizada.`,
          actorUserId: who.id,
          actorName: who.name,
          metadata: json({
            planId: plan.id,
            runId: run.id,
            action: plan.action,
            mode: "SIMULATED",
            mutationPerformed: false,
            version: "015.6.11.5.3",
          }),
        },
      });

      return updatedRun;
    });

    return { reused: false, run: completed };
  } catch (error) {
    const finishedAt = new Date();
    const message =
      error instanceof Error ? error.message : "Falha na execução simulada.";

    await prisma.remediationExecutionRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorMessage: message,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      },
    });

    throw error;
  }
}
