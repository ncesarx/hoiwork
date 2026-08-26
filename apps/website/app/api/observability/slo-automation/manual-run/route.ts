import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { runSloAutomation } from "@/lib/observability/slo-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Acesso negado.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const result = await runSloAutomation({
      organizationId: organization.id,
      respectEnabled: false,
    });

    if (
      result.skipped ||
      !result.snapshotId ||
      !result.alerts
    ) {
      return NextResponse.json({
        ok: true,
        message:
          "reason" in result
            ? `Execução ignorada: ${result.reason}.`
            : "Execução concluída sem snapshot.",
        result,
      });
    }

    const activeTrendAlerts = result.alerts.active;

    return NextResponse.json({
      ok: true,
      message:
        `Snapshot ${result.snapshotId} capturado. ` +
        `Trend alerts ativos: ${activeTrendAlerts}.`,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha no ciclo manual SLO.",
      },
      {
        status: 500,
      },
    );
  }
}
