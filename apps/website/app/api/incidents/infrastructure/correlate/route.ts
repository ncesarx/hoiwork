import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { correlateInfrastructureIncidents } from "@/lib/incidents/infrastructure-correlation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
  }

  try {
    const result = await correlateInfrastructureIncidents(organization.id);

    return NextResponse.json({
      ok: true,
      message: `${result.candidates} condição(ões) correlacionada(s), ${result.opened} novo(s), ${result.resolved} resolvido(s).`,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Falha na correlação.",
      },
      { status: 500 },
    );
  }
}
