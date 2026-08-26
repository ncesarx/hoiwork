import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runIncidentSlaAutomation } from "@/lib/incidents/sla-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.HOIWORK_AUTOMATION_SECRET;
  if (!expected) return false;

  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Scheduler não autorizado." },
      { status: 401 },
    );
  }

  /*
   * Somente organizações com incidentes ativos são avaliadas.
   * Isso evita criar runs vazios para tenants sem trabalho operacional.
   */
  const active = await prisma.infrastructureIncident.findMany({
    where: {
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
    },
    select: { organizationId: true },
    distinct: ["organizationId"],
    orderBy: { organizationId: "asc" },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const item of active) {
    try {
      const result = await runIncidentSlaAutomation({
        organizationId: item.organizationId,
        source: "SCHEDULER",
        commit: true,
      });

      results.push({
        organizationId: item.organizationId,
        ...result,
      });
    } catch (error) {
      results.push({
        organizationId: item.organizationId,
        skipped: false,
        status: "FAILED",
        error:
          error instanceof Error
            ? error.message
            : "Falha desconhecida no SLA Scheduler.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    organizations: active.length,
    results,
  });
}
