import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export class SessionRevocationError extends Error {
  constructor(message: string, readonly status: 403 | 409) {
    super(message);
  }
}

export async function revokeOwnSessions(input: {
  organizationId: string;
  userId: string;
  sessionVersion: number;
  currentPassword: string;
}) {
  return prisma.$transaction(async (tx) => {
    const [organization] = await tx.$queryRaw<Array<{ active: boolean }>>`
      SELECT "active" FROM "Organization" WHERE "id" = ${input.organizationId} FOR UPDATE
    `;
    if (!organization?.active) throw new SessionRevocationError("Organização indisponível.", 403);
    const [user] = await tx.$queryRaw<Array<{ passwordHash: string | null; sessionVersion: number; active: boolean }>>`
      SELECT "passwordHash", "sessionVersion", "active" FROM "User"
      WHERE "id" = ${input.userId} FOR UPDATE
    `;
    const membership = await tx.membership.findUnique({
      where: { userId_organizationId: { userId: input.userId, organizationId: input.organizationId } },
      select: { active: true },
    });
    if (!user?.active || !membership?.active) throw new SessionRevocationError("Acesso indisponível.", 403);
    if (user.sessionVersion !== input.sessionVersion) {
      throw new SessionRevocationError("Sua sessão expirou. Entre novamente.", 409);
    }
    if (!user.passwordHash || !await compare(input.currentPassword, user.passwordHash)) {
      throw new SessionRevocationError("Senha atual incorreta.", 403);
    }
    const updated = await tx.user.update({
      where: { id: input.userId },
      data: { sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    });
    await tx.auditLog.create({ data: {
      organizationId: input.organizationId, userId: input.userId,
      action: "USER_SESSIONS_REVOKED", entity: "User", entityId: input.userId,
    } });
    return { sessionVersion: updated.sessionVersion };
  });
}
