import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { runIncidentSlaAutomation } from "@/lib/incidents/sla-automation";

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
    const result = await runIncidentSlaAutomation({
      organizationId: organization.id,
      source: "MANUAL",
      commit,
    });

    if (result.executionSkipped) {
      return NextResponse.json({
        ok: true,
        message: `Execução ignorada: ${result.reason}.`,
        result,
      });
    }

    return NextResponse.json({
      ok: true,
      message:
        `${result.mode}: ${result.inspected} incidente(s), ` +
        `${result.ackBreaches} ACK breach(es), ` +
        `${result.resolveBreaches} resolution breach(es), ` +
        `${result.escalationsCreated} escalonamento(s) criado(s).`,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha no SLA Engine.",
      },
      { status: 500 },
    );
  }
}
