import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

const MAX_FAILED_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

/** Serializes password checks with password changes and concurrent login attempts. */
export async function verifyCredentialLogin(userId: string, password: string) {
  return prisma.$transaction(async (tx) => {
    const [user] = await tx.$queryRaw<Array<{
      active: boolean;
      passwordHash: string | null;
      failedLoginAttempts: number;
      lastFailedLoginAt: Date | null;
      sessionVersion: number;
    }>>`
      SELECT "active", "passwordHash", "failedLoginAttempts", "lastFailedLoginAt", "sessionVersion"
      FROM "User" WHERE "id" = ${userId} FOR UPDATE
    `;
    if (!user?.active || !user.passwordHash) return null;

    const now = new Date();
    const inWindow = user.lastFailedLoginAt !== null &&
      now.getTime() - user.lastFailedLoginAt.getTime() < WINDOW_MS;
    if (inWindow && user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) return null;

    if (!(await compare(password, user.passwordHash))) {
      const failedLoginAttempts = inWindow ? user.failedLoginAttempts + 1 : 1;
      await tx.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts,
          lastFailedLoginAt: now,
        },
      });
      if (failedLoginAttempts === MAX_FAILED_ATTEMPTS) {
        const membership = await tx.membership.findFirst({
          where: { userId, active: true, organization: { active: true } },
          orderBy: { createdAt: "asc" },
          select: { organizationId: true },
        });
        await tx.auditLog.create({ data: {
          organizationId: membership?.organizationId ?? null,
          action: "ACCOUNT_LOGIN_THROTTLED",
          entity: "User", entityId: userId,
          // The caller is not authenticated; userId is the actor, not the target.
        } });
      }
      return null;
    }

    if (user.failedLoginAttempts || user.lastFailedLoginAt) {
      await tx.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: 0, lastFailedLoginAt: null },
      });
    }
    return { sessionVersion: user.sessionVersion };
  });
}
