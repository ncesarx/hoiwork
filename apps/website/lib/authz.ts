import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getActiveMembership } from "@/lib/organization/access";

export const requirePortalSession = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
});

export const requireOrganization = cache(async () => {
  const session = await requirePortalSession();
  const organizationId = session.user.organizationId;
  if (!organizationId) redirect("/login?error=organization");

  const membership = await getActiveMembership(session.user.id, organizationId);

  if (!membership) redirect("/login?error=access");
  session.user.role = membership.role;
  session.user.organizationName = membership.organization.name;
  return { session, membership, organization: membership.organization };
});
