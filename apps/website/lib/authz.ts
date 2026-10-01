import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getSelectedMembership } from "@/lib/organization/access";
import { ORGANIZATION_CONTEXT_COOKIE } from "@/lib/organization/context-cookie";

export const requirePortalSession = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
});

export const requireOrganization = cache(async () => {
  const session = await requirePortalSession();
  const rawPreference = (await cookies()).get(ORGANIZATION_CONTEXT_COOKIE)?.value ?? null;
  const preference = rawPreference && rawPreference.length <= 128 ? rawPreference : null;
  const membership = await getSelectedMembership(session.user.id, preference, session.user.organizationId);

  if (!membership || session.user.sessionVersion !== membership.user.sessionVersion) {
    redirect("/login?error=access");
  }
  session.user.role = membership.role;
  session.user.organizationId = membership.organizationId;
  session.user.organizationName = membership.organization.name;
  return { session, membership, organization: membership.organization };
});
