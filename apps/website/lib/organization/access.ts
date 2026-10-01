import { prisma } from "@/lib/prisma";

export async function getActiveMembership(userId: string, organizationId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: {
      organization: true,
      user: { select: { active: true, sessionVersion: true } },
    },
  });

  if (!membership?.active || !membership.organization.active || !membership.user.active) return null;
  return membership;
}

export async function getOrganizationMembers(organizationId: string) {
  return prisma.membership.findMany({
    where: { organizationId },
    select: {
      id: true,
      userId: true,
      role: true,
      active: true,
      createdAt: true,
      user: {
        select: {
          name: true,
          email: true,
          active: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}
