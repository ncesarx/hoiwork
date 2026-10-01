"use server";

import { cookies } from "next/headers";
import { auth, signOut } from "@/auth";
import { getSelectedMembership } from "@/lib/organization/access";
import { ORGANIZATION_CONTEXT_COOKIE } from "@/lib/organization/context-cookie";
import { prisma } from "@/lib/prisma";

export async function endPortalSession() {
  const cookieJar = await cookies();
  try {
    const session = await auth();
    if (session?.user?.id) {
      const preference = cookieJar.get(ORGANIZATION_CONTEXT_COOKIE)?.value ?? null;
      const membership = await getSelectedMembership(
        session.user.id, preference && preference.length <= 128 ? preference : null, session.user.organizationId,
      );
      if (membership && membership.user.sessionVersion === session.user.sessionVersion) {
        await prisma.auditLog.create({ data: {
          organizationId: membership.organizationId, userId: session.user.id,
          action: "ACCOUNT_SIGNED_OUT", entity: "User", entityId: session.user.id,
        } });
      }
    }
  } finally {
    // Logout still succeeds if the audit database is unavailable.
    cookieJar.delete(ORGANIZATION_CONTEXT_COOKIE);
    await signOut({ redirectTo: "/login" });
  }
}
