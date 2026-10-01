import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export class PasswordChangeError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 409) {
    super(message);
  }
}

export async function changeOwnPassword(input: {
  organizationId: string;
  userId: string;
  sessionVersion: number;
  currentPassword: string;
  newPassword: string;
}) {
  if (input.currentPassword === input.newPassword) {
    throw new PasswordChangeError("Escolha uma senha diferente da atual.", 400);
  }
  const newPasswordHash = await hash(input.newPassword, 12);

  return prisma.$transaction(async (tx) => {
    // Match the organization-first lock order used by membership edits.
    const [organization] = await tx.$queryRaw<Array<{ active: boolean }>>`
      SELECT "active" FROM "Organization" WHERE "id" = ${input.organizationId} FOR UPDATE
    `;
    if (!organization?.active) throw new PasswordChangeError("Organização indisponível.", 403);
    const [user] = await tx.$queryRaw<Array<{ passwordHash: string | null; sessionVersion: number; active: boolean }>>`
      SELECT "passwordHash", "sessionVersion", "active" FROM "User"
      WHERE "id" = ${input.userId} FOR UPDATE
    `;
    const membership = await tx.membership.findUnique({
      where: { userId_organizationId: { userId: input.userId, organizationId: input.organizationId } },
      select: { active: true },
    });
    if (!user?.active || !membership?.active) {
      throw new PasswordChangeError("Acesso indisponível.", 403);
    }
    if (user.sessionVersion !== input.sessionVersion) {
      throw new PasswordChangeError("Sua sessão expirou. Entre novamente.", 409);
    }
    if (!user.passwordHash || !(await compare(input.currentPassword, user.passwordHash))) {
      throw new PasswordChangeError("Senha atual incorreta.", 403);
    }
    if (await compare(input.newPassword, user.passwordHash)) {
      throw new PasswordChangeError("Escolha uma senha diferente da atual.", 400);
    }

    const updated = await tx.user.update({
      where: { id: input.userId },
      data: { passwordHash: newPasswordHash, sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    });
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId, userId: input.userId,
        action: "USER_PASSWORD_CHANGED", entity: "User", entityId: input.userId,
        metadata: { sessionVersion: updated.sessionVersion },
      },
    });
    return { sessionVersion: updated.sessionVersion };
  });
}
