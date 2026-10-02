import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { organizationProfileSchema, OrganizationProfileError, updateOrganizationProfile } from "@/lib/organization/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const { session, organization, membership } = await requireOrganization();
  if (membership.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Somente ADMIN pode alterar o nome da empresa." }, { status: 403 });
  }
  const parsed = organizationProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Informe o nome da empresa com até 120 caracteres." }, { status: 400 });
  }
  try {
    const result = await updateOrganizationProfile({
      organizationId: organization.id, actorUserId: session.user.id, ...parsed.data,
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OrganizationProfileError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível atualizar o nome da empresa." }, { status: 500 });
  }
}
