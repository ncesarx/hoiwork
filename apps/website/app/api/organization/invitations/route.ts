import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganization } from "@/lib/authz";
import { createInvitation, InvitationError } from "@/lib/organization/invitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  role: z.enum(["CLIENT", "MANAGER", "TECHNICIAN"]),
}).strict();

export async function POST(request: Request) {
  const { session, organization, membership } = await requireOrganization();
  if (membership.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Somente ADMIN pode criar convites." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Informe nome, e-mail e papel válidos." }, { status: 400 });
  }
  try {
    const result = await createInvitation({
      organizationId: organization.id, actorUserId: session.user.id, ...parsed.data,
    });
    return NextResponse.json({ ok: true, ...result }, {
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  } catch (error) {
    if (error instanceof InvitationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível criar o convite." }, { status: 500 });
  }
}
