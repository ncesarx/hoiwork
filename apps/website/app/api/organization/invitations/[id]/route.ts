import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganization } from "@/lib/authz";
import { InvitationError, replaceInvitation, revokeInvitation } from "@/lib/organization/invitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const replacementSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  role: z.enum(["CLIENT", "MANAGER", "TECHNICIAN"]),
}).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { session, organization, membership } = await requireOrganization();
  if (membership.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Somente ADMIN pode substituir convites." }, { status: 403 });
  }
  const parsed = replacementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Informe nome, e-mail e papel válidos." }, { status: 400 });
  }
  try {
    const { id } = await context.params;
    const result = await replaceInvitation({
      organizationId: organization.id, actorUserId: session.user.id, invitationId: id, ...parsed.data,
    });
    return NextResponse.json({ ok: true, ...result }, {
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  } catch (error) {
    if (error instanceof InvitationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível substituir o convite." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { session, organization, membership } = await requireOrganization();
  if (membership.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Somente ADMIN pode revogar convites." }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const result = await revokeInvitation({
      organizationId: organization.id, actorUserId: session.user.id, invitationId: id,
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InvitationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível revogar o convite." }, { status: 500 });
  }
}
