import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runDiscoveryAutomation } from "@/lib/discovery/discovery-automation";

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

  const configs = await prisma.discoveryAutomationConfig.findMany({
    where: { enabled: true },
    orderBy: { organizationId: "asc" },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const config of configs) {
    try {
      const result = await runDiscoveryAutomation({
        organizationId: config.organizationId,
        source: "SCHEDULER",
        respectEnabled: true,
      });

      results.push({
        organizationId: config.organizationId,
        ...result,
      });
    } catch (error) {
      results.push({
        organizationId: config.organizationId,
        skipped: false,
        status: "FAILED",
        error:
          error instanceof Error ? error.message : "Falha desconhecida.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    organizations: configs.length,
    results,
  });
}
