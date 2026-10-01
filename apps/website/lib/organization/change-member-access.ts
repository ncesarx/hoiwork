import { prisma } from "@/lib/prisma";

export class MembershipAccessError extends Error {
  constructor(message: string, readonly status: 403 | 404 | 409) {
    super(message);
  }
}

export async function changeMemberAccess(input: {
  organizationId: string;
  actorUserId: string;
  membershipId: string;
  expectedActive: boolean;
  active: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    // Serialize with role edits and other access changes in this organization.
    const [organization] = await tx.$queryRaw<Array<{ active: boolean }>>`
      SELECT "active" FROM "Organization" WHERE "id" = ${input.organizationId} FOR UPDATE
    `;
    if (!organization?.active) throw new MembershipAccessError("Organização indisponível.", 403);

    const actor = await tx.membership.findUnique({
      where: { userId_organizationId: { userId: input.actorUserId, organizationId: input.organizationId } },
      include: { user: { select: { active: true } } },
    });
    if (actor?.role !== "ADMIN" || !actor.active || !actor.user.active) {
      throw new MembershipAccessError("Somente ADMIN ativo pode alterar acessos.", 403);
    }

    const target = await tx.membership.findFirst({
      where: { id: input.membershipId, organizationId: input.organizationId },
      include: { user: { select: { active: true } } },
    });
    if (!target) throw new MembershipAccessError("Vínculo não encontrado.", 404);
    if (target.userId === input.actorUserId) {
      throw new MembershipAccessError("Não é permitido suspender ou reativar o próprio acesso.", 409);
    }
    if (target.active !== input.expectedActive) {
      throw new MembershipAccessError("O acesso mudou. Atualize a página antes de salvar.", 409);
    }
    if (target.active === input.active) return { changed: false, active: target.active };
    if (input.active && !target.user.active) {
      throw new MembershipAccessError("A conta global está inativa.", 409);
    }
    if (target.role === "ADMIN" && !input.active && target.user.active) {
      const admins = await tx.membership.count({
        where: { organizationId: input.organizationId, role: "ADMIN", active: true, user: { active: true } },
      });
      if (admins <= 1) throw new MembershipAccessError("O último ADMIN deve permanecer ativo.", 409);
    }

    await tx.membership.update({ where: { id: target.id }, data: { active: input.active } });
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.actorUserId,
        action: input.active ? "MEMBERSHIP_ACCESS_RESTORED" : "MEMBERSHIP_ACCESS_SUSPENDED",
        entity: "Membership",
        entityId: target.id,
        metadata: { targetUserId: target.userId, role: target.role },
      },
    });

    return { changed: true, active: input.active };
  });
}
