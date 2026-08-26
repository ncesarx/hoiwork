import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildRemediationIntelligence } from "@/lib/incidents/remediation-intelligence";

function actor(session: { user: { id: string; name?: string | null; email?: string | null }}) {
  return {
    id: session.user.id,
    name: session.user.name ?? session.user.email ?? "Operador",
  };
}

export async function createPlan(input: {
  organizationId: string;
  incidentId: string;
  session: { user: { id: string; name?: string | null; email?: string | null } };
}) {
  const intelligence = await buildRemediationIntelligence(
    input.organizationId,
    input.incidentId,
  );

  if (!intelligence) throw new Error("Incidente não encontrado.");

  const r = intelligence.recommendation;
  if (r.action === "NO_ACTION" || r.safetyClass === "BLOCKED") {
    throw new Error("A recomendação atual não permite criação de plano.");
  }

  const who = actor(input.session);

  const existing = await prisma.remediationExecutionPlan.findFirst({
    where: {
      organizationId: input.organizationId,
      incidentId: input.incidentId,
      action: r.action,
      status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) return existing;

  return prisma.remediationExecutionPlan.create({
    data: {
      organizationId: input.organizationId,
      incidentId: input.incidentId,
      action: r.action,
      safetyClass: r.safetyClass,
      rationale: r.rationale,
      risk: r.risk,
      requiresApproval: r.requiresApproval,
      executableNow: false,
      realExecutionEnabled: false,
      verificationPlan: r.verification as Prisma.InputJsonValue,
      rollbackPlan: r.rollback as Prisma.InputJsonValue,
      blockers: r.blockers as Prisma.InputJsonValue,
      evidence: intelligence.evidence as Prisma.InputJsonValue,
      createdById: who.id,
      createdByName: who.name,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
}

export async function submitPlan(input: {
  organizationId: string;
  incidentId: string;
  planId: string;
  session: { user: { id: string; name?: string | null; email?: string | null } };
}) {
  const plan = await prisma.remediationExecutionPlan.findFirst({
    where: { id: input.planId, organizationId: input.organizationId, incidentId: input.incidentId },
  });
  if (!plan) throw new Error("Plano não encontrado.");
  if (plan.status !== "DRAFT") throw new Error("Somente planos DRAFT podem ser submetidos.");

  const who = actor(input.session);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.remediationExecutionPlan.update({
      where: { id: plan.id },
      data: { status: "PENDING_APPROVAL", submittedAt: now },
    });

    await tx.remediationApproval.create({
      data: {
        organizationId: input.organizationId,
        planId: plan.id,
        decision: "SUBMITTED",
        actorUserId: who.id,
        actorName: who.name,
        metadata: { version: "015.6.11.5.2" },
      },
    });

    return updated;
  });
}

export async function decidePlan(input: {
  organizationId: string;
  incidentId: string;
  planId: string;
  approve: boolean;
  reason?: string | null;
  session: { user: { id: string; name?: string | null; email?: string | null; role?: string | null } };
}) {
  if (input.session.user.role !== "ADMIN") {
    throw new Error("Somente ADMIN pode aprovar ou rejeitar planos.");
  }

  const plan = await prisma.remediationExecutionPlan.findFirst({
    where: { id: input.planId, organizationId: input.organizationId, incidentId: input.incidentId },
  });
  if (!plan) throw new Error("Plano não encontrado.");
  if (plan.status !== "PENDING_APPROVAL") {
    throw new Error("Plano não está aguardando aprovação.");
  }

  const who = actor(input.session);
  const now = new Date();

  if (plan.expiresAt && plan.expiresAt < now) {
    return prisma.remediationExecutionPlan.update({
      where: { id: plan.id },
      data: { status: "EXPIRED" },
    });
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.remediationExecutionPlan.update({
      where: { id: plan.id },
      data: input.approve
        ? {
            status: "APPROVED",
            approvedAt: now,
            approvedById: who.id,
            approvedByName: who.name,
            executableNow: false,
            realExecutionEnabled: false,
          }
        : {
            status: "REJECTED",
            rejectedAt: now,
            rejectedById: who.id,
            rejectedByName: who.name,
            rejectionReason: input.reason?.trim().slice(0, 2000) || null,
          },
    });

    await tx.remediationApproval.create({
      data: {
        organizationId: input.organizationId,
        planId: plan.id,
        decision: input.approve ? "APPROVED" : "REJECTED",
        actorUserId: who.id,
        actorName: who.name,
        reason: input.reason?.trim().slice(0, 2000) || null,
        metadata: {
          realExecutionEnabled: false,
          executableNow: false,
          version: "015.6.11.5.2",
        },
      },
    });

    return updated;
  });
}
