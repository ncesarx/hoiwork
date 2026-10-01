import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganization } from "@/lib/authz";
import { changeMemberAccess, MembershipAccessError } from "@/lib/organization/change-member-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ expectedActive: z.boolean(), active: z.boolean() }).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { session, organization, membership } = await requireOrganization();
  if (membership.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Somente ADMIN pode alterar acessos." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Informe o estado esperado e o novo estado do acesso." }, { status: 400 });
  }
  try {
    const { id } = await context.params;
    const result = await changeMemberAccess({
      organizationId: organization.id,
      actorUserId: session.user.id,
      membershipId: id,
      ...parsed.data,
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MembershipAccessError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível alterar o acesso." }, { status: 500 });
  }
}
