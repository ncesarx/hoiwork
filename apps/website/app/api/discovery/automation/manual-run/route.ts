import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { runDiscoveryAutomation } from "@/lib/discovery/discovery-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json(
      { ok: false, error: "Acesso negado." },
      { status: 403 },
    );
  }

  try {
    const result = await runDiscoveryAutomation({
      organizationId: organization.id,
      source: "MANUAL",
      respectEnabled: false,
    });

    if (result.skipped) {
      return NextResponse.json({
        ok: true,
        message: `Execução ignorada: ${result.reason}.`,
        result,
      });
    }

    return NextResponse.json({
      ok: true,
      message:
        `Discovery ${result.status}: ${result.succeeded}/${result.instances} instância(s) OK, ` +
        `${result.assetsDiscovered} recurso(s) descoberto(s).`,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha no ciclo manual de Discovery.",
      },
      { status: 500 },
    );
  }
}
