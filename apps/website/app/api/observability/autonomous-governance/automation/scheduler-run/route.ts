import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAutonomousGovernanceAutomation } from "@/lib/governance/autonomous-governance-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.HOIWORK_AUTOMATION_SECRET;

  if (!expected) {
    return false;
  }

  return (
    request.headers.get("authorization") ===
    `Bearer ${expected}`
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Scheduler não autorizado.",
      },
      {
        status: 401,
      },
    );
  }

  const configs =
    await prisma.autonomousGovernanceAutomationConfig.findMany({
      where: {
        enabled: true,
      },
      orderBy: {
        organizationId: "asc",
      },
    });

  const results = [];
  let failures = 0;

  for (const config of configs) {
    try {
      const result =
        await runAutonomousGovernanceAutomation({
          organizationId: config.organizationId,
          source: "SCHEDULER",
          respectEnabled: true,
        });

      results.push({
        organizationId: config.organizationId,
        ...result,
      });
    } catch (error) {
      failures += 1;
      console.error("Autonomous Governance Scheduler falhou", {
        organizationId: config.organizationId,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      results.push({
        organizationId: config.organizationId,
        skipped: false,
        status: "FAILED",
        error: "Falha na execução do scheduler. Consulte os logs do HOIWORK.",
      });
    }
  }

  return NextResponse.json(
    {
      ok: failures === 0,
      organizations: configs.length,
      failures,
      results,
    },
    { status: failures > 0 ? 500 : 200 },
  );
}
