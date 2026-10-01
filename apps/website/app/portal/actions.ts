"use server";

import { cookies } from "next/headers";
import { signOut } from "@/auth";
import { ORGANIZATION_CONTEXT_COOKIE } from "@/lib/organization/context-cookie";

export async function endPortalSession() {
  (await cookies()).delete(ORGANIZATION_CONTEXT_COOKIE);
  await signOut({ redirectTo: "/login" });
}
