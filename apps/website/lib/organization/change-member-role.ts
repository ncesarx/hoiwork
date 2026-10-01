import type { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class MembershipRoleChangeError extends Error {
  constructor(message: string, readonly status: 403 | 404 | 409) {
    super(message);
  }
}

export async function changeMemberRole(input: {
  organizationId: string;
  actorUserId: string;
  membershipId: string;
  expectedRole: MembershipRole;
  role: MembershipRole;
}) {
  return prisma.$transaction(async (tx) => {
    // Serialize role edits in this organization, including two admins editing each other.
    const [organization] = await tx.$queryRaw<Array<{ active: boolean }>>`
      SELECT "active" FROM "Organization"
      WHERE "id" = ${input.organizationId} FOR UPDATE
    `;
    if (!organization?.active) {
      throw new MembershipRoleChangeError("Organização indisponível.", 403);
    }

    const actor = await tx.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: input.actorUserId,
          organizationId: input.organizationId,
        },
      },
      include: { user: { select: { active: true } } },
    });
    if (actor?.role !== "ADMIN" || !actor.user.active) {
      throw new MembershipRoleChangeError("Somente ADMIN pode alterar papéis.", 403);
    }

    const target = await tx.membership.findFirst({
      where: { id: input.membershipId, organizationId: input.organizationId },
    });
    if (!target) throw new MembershipRoleChangeError("Vínculo não encontrado.", 404);
    if (target.userId === input.actorUserId) {
      throw new MembershipRoleChangeError("Não é permitido alterar o próprio papel.", 409);
    }
    if (target.role !== input.expectedRole) {
      throw new MembershipRoleChangeError("O papel mudou. Atualize a página antes de salvar.", 409);
    }
    if (target.role === input.role) return { changed: false, role: target.role };

    if (target.role === "ADMIN" && input.role !== "ADMIN") {
      const admins = await tx.membership.count({
        where: { organizationId: input.organizationId, role: "ADMIN" },
      });
      if (admins <= 1) {
        throw new MembershipRoleChangeError("O último ADMIN deve permanecer na organização.", 409);
      }
    }

    await tx.membership.update({ where: { id: target.id }, data: { role: input.role } });
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.actorUserId,
        action: "MEMBERSHIP_ROLE_CHANGED",
        entity: "Membership",
        entityId: target.id,
        metadata: {
          targetUserId: target.userId,
          previousRole: target.role,
          newRole: input.role,
        },
      },
    });

    return { changed: true, role: input.role };
  });
}
