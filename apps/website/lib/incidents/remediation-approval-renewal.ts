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
    name: session.user.name ?? session.user.email ?? "Administrador",
  };
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function renewRemediationApproval(input: {
  organizationId: string;
  incidentId: string;
  planId: string;
  reason?: string | null;
  session: SessionLike;
}) {
  if (input.session.user.role !== "ADMIN") {
    throw new Error("Somente ADMIN pode renovar aprovação.");
  }

  const plan = await prisma.remediationExecutionPlan.findFirst({
    where: {
      id: input.planId,
      organizationId: input.organizationId,
      incidentId: input.incidentId,
    },
  });

  if (!plan) throw new Error("Plano não encontrado.");
  if (plan.status !== "APPROVED") {
    throw new Error("Somente planos APPROVED podem ter aprovação renovada.");
  }

  const now = new Date();

  if (plan.expiresAt && plan.expiresAt <= now) {
    throw new Error("Plano expirado. Crie um novo plano após nova recomendação.");
  }

  if (!plan.approvedAt) {
    throw new Error("Plano APPROVED sem approvedAt válido.");
  }

  const maxAgeMinutes = Number(
    process.env.HOIWORK_REMEDIATION_APPROVAL_MAX_AGE_MINUTES ?? "60",
  );

  const ageMinutes = Math.max(
    0,
    Math.floor((now.getTime() - plan.approvedAt.getTime()) / 60000),
  );

  if (ageMinutes <= maxAgeMinutes) {
    return {
      renewed: false,
      reason: "APPROVAL_STILL_FRESH",
      plan,
      ageMinutes,
      maxAgeMinutes,
    };
  }

  const who = actor(input.session);
  const previousApprovedAt = plan.approvedAt;
  const previousApprovedById = plan.approvedById;
  const previousApprovedByName = plan.approvedByName;

  const updated = await prisma.$transaction(async (tx) => {
    const refreshed = await tx.remediationExecutionPlan.update({
      where: { id: plan.id },
      data: {
        approvedAt: now,
        approvedById: who.id,
        approvedByName: who.name,
        executableNow: false,
        realExecutionEnabled: false,
      },
    });

    await tx.remediationApproval.create({
      data: {
        organizationId: input.organizationId,
        planId: plan.id,
        decision: "REAPPROVED",
        actorUserId: who.id,
        actorName: who.name,
        reason: input.reason?.trim().slice(0, 2000) || null,
        metadata: json({
          version: "015.6.11.5.2.1",
          previousApprovedAt: previousApprovedAt.toISOString(),
          previousApprovedById,
          previousApprovedByName,
          newApprovedAt: now.toISOString(),
          approvalAgeMinutesBeforeRenewal: ageMinutes,
          maxApprovalAgeMinutes: maxAgeMinutes,
          executableNow: false,
          realExecutionEnabled: false,
        }),
      },
    });

    await tx.infrastructureIncidentEvent.create({
      data: {
        organizationId: input.organizationId,
        incidentId: input.incidentId,
        eventType: "REMEDIATION_PLAN_REAPPROVED",
        message:
          `Aprovação do plano ${plan.action} renovada por ${who.name}. ` +
          "Execução real permanece bloqueada.",
        actorUserId: who.id,
        actorName: who.name,
        metadata: json({
          version: "015.6.11.5.2.1",
          planId: plan.id,
          action: plan.action,
          previousApprovedAt: previousApprovedAt.toISOString(),
          newApprovedAt: now.toISOString(),
          approvalAgeMinutesBeforeRenewal: ageMinutes,
          maxApprovalAgeMinutes: maxAgeMinutes,
          executableNow: false,
          realExecutionEnabled: false,
        }),
      },
    });

    return refreshed;
  });

  return {
    renewed: true,
    reason: "APPROVAL_RENEWED",
    plan: updated,
    ageMinutes,
    maxAgeMinutes,
  };
}
