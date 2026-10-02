import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { ORGANIZATION_CONTEXT_COOKIE } from "@/lib/organization/context-cookie";
import { createClientOrganization, OrganizationCreationError } from "@/lib/organization/create";
import { organizationProfileSchema } from "@/lib/organization/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { session, organization, membership } = await requireOrganization();
  if (membership.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Somente ADMIN pode cadastrar uma empresa." }, { status: 403 });
  }
  const parsed = organizationProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Informe o nome da empresa com até 120 caracteres." }, { status: 400 });
  }
  try {
    const created = await createClientOrganization({
      sourceOrganizationId: organization.id, actorUserId: session.user.id, ...parsed.data,
    });
    const response = NextResponse.json({ ok: true, organizationId: created.id, name: created.name }, {
      status: 201, headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set(ORGANIZATION_CONTEXT_COOKIE, created.id, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    if (error instanceof OrganizationCreationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível cadastrar a empresa. Confira a lista de organizações antes de tentar novamente." }, { status: 500 });
  }
}
