import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganization } from "@/lib/authz";
import { changeMemberRole, MembershipRoleChangeError } from "@/lib/organization/change-member-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  expectedRole: z.enum(["CLIENT", "MANAGER", "TECHNICIAN", "ADMIN"]),
  role: z.enum(["CLIENT", "MANAGER", "TECHNICIAN", "ADMIN"]),
}).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { session, organization, membership } = await requireOrganization();
  if (membership.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Somente ADMIN pode alterar papéis." }, { status: 403 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Informe um papel válido." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const result = await changeMemberRole({
      organizationId: organization.id,
      actorUserId: session.user.id,
      membershipId: id,
      expectedRole: parsed.data.expectedRole,
      role: parsed.data.role,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof MembershipRoleChangeError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível alterar o papel." }, { status: 500 });
  }
}
