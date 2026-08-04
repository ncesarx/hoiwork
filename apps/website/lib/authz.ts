import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const requirePortalSession = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
});

export const requireOrganization = cache(async () => {
  const session = await requirePortalSession();
  const organizationId = session.user.organizationId;
  if (!organizationId) redirect("/login?error=organization");

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId,
      },
    },
    include: { organization: true },
  });

  if (!membership?.organization.active) redirect("/login?error=access");
  return { session, membership, organization: membership.organization };
});
