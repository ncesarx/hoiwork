import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { runNotificationAutomation } from "@/lib/notifications/automation-runner";

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
    const result = await runNotificationAutomation({
      organizationId: organization.id,
      source: "MANUAL",
      respectEnabled: false,
    });

    return NextResponse.json({
      ok: true,
      message: result.skipped
        ? `Execução ignorada: ${result.reason}.`
        : `Automation Run ${result.runId} concluído em ${result.durationMs} ms.`,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha na execução manual.",
      },
      { status: 500 },
    );
  }
}
