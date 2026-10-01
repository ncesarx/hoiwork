import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganization } from "@/lib/authz";
import { ORGANIZATION_CONTEXT_COOKIE } from "@/lib/organization/context-cookie";
import { revokeOwnSessions, SessionRevocationError } from "@/lib/organization/revoke-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ currentPassword: z.string().min(8).max(128) }).strict();

export async function POST(request: Request) {
  const { organization, session } = await requireOrganization();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Informe sua senha atual." }, { status: 400 });
  }
  try {
    await revokeOwnSessions({
      organizationId: organization.id, userId: session.user.id,
      sessionVersion: session.user.sessionVersion, currentPassword: parsed.data.currentPassword,
    });
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.delete(ORGANIZATION_CONTEXT_COOKIE);
    return response;
  } catch (error) {
    if (error instanceof SessionRevocationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível encerrar as sessões." }, { status: 500 });
  }
}
