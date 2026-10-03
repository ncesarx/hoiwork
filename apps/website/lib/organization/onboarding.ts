import { prisma } from "@/lib/prisma";

export async function getOrganizationOnboardingAccess(organizationId: string, currentUserId: string) {
  const [activeOtherUsers, pendingInvitations] = await Promise.all([
    prisma.membership.count({ where: {
      organizationId, active: true, userId: { not: currentUserId },
      user: { active: true }, organization: { active: true },
    } }),
    prisma.organizationInvitation.count({ where: {
      organizationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() },
      organization: { active: true },
    } }),
  ]);
  return { activeOtherUsers, pendingInvitations };
}
