import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalSession } from "@/lib/authz";
import { getActiveMembership } from "@/lib/organization/access";
import { ORGANIZATION_CONTEXT_COOKIE } from "@/lib/organization/context-cookie";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ organizationId: z.string().min(1).max(128) }).strict();

export async function POST(request: Request) {
  const session = await requirePortalSession();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Organização inválida." }, { status: 400 });
  }
  const membership = await getActiveMembership(session.user.id, parsed.data.organizationId);
  if (!membership || membership.user.sessionVersion !== session.user.sessionVersion) {
    return NextResponse.json({ ok: false, error: "Acesso indisponível para esta organização." }, { status: 403 });
  }
  await prisma.auditLog.create({ data: {
    organizationId: membership.organizationId, userId: session.user.id,
    action: "ORGANIZATION_CONTEXT_CHANGED", entity: "User", entityId: session.user.id,
  } });
  const response = NextResponse.json({ ok: true, organizationId: membership.organizationId }, {
    headers: { "Cache-Control": "no-store" },
  });
  response.cookies.set(ORGANIZATION_CONTEXT_COOKIE, membership.organizationId, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
