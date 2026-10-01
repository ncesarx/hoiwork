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

export async function getSelectedMembership(userId: string, preferredId: string | null, fallbackId: string | null) {
  if (preferredId) {
    const preferred = await getActiveMembership(userId, preferredId);
    if (preferred) return preferred;
  }
  return fallbackId && fallbackId !== preferredId ? getActiveMembership(userId, fallbackId) : null;
}

export async function getActiveOrganizationsForUser(userId: string) {
  return prisma.membership.findMany({
    where: { userId, active: true, user: { active: true }, organization: { active: true } },
    select: { organizationId: true, organization: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
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
