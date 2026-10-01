import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { InvitationError, revokeInvitation } from "@/lib/organization/invitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
