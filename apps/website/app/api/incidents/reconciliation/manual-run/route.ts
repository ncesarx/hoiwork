import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { reconcileInfrastructureIncidents } from "@/lib/incidents/reconciliation-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json(
      { ok: false, error: "Acesso negado." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const commit = Boolean(body.commit);

  try {
    const result = await reconcileInfrastructureIncidents({
      organizationId: organization.id,
      source: "MANUAL",
      commit,
    });

    return NextResponse.json({
      ok: true,
      message:
        `${result.mode}: ${result.inspected} incidente(s) inspecionado(s), ` +
        `${result.resolved} resolvido(s), ${result.keptOpen} mantido(s), ` +
        `${result.skipped} ignorado(s).`,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha na reconciliação de incidentes.",
      },
      { status: 500 },
    );
  }
}
