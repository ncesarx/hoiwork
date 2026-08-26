import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runNotificationAutomation } from "@/lib/notifications/automation-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.HOIWORK_AUTOMATION_SECRET;
  if (!expected) return false;

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Scheduler não autorizado." },
      { status: 401 },
    );
  }

  const configs = await prisma.notificationAutomationConfig.findMany({
    where: { enabled: true },
    orderBy: { organizationId: "asc" },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const config of configs) {
    const due =
      !config.lastRunAt ||
      Date.now() - config.lastRunAt.getTime() >= config.intervalMinutes * 60000;

    if (!due) {
      results.push({
        organizationId: config.organizationId,
        skipped: true,
        reason: "INTERVAL_NOT_DUE",
      });
      continue;
    }

    try {
      const result = await runNotificationAutomation({
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
          error instanceof Error
            ? error.message
            : "Falha desconhecida.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    organizations: configs.length,
    results,
  });
}
