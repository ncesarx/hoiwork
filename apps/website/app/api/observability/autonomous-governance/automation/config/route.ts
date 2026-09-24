import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  enabled: z.boolean(),
  intervalMinutes: z.number().int().min(5).max(1440),
}).strict();

export async function POST(request: Request) {
  const { session, organization } = await requireOrganization();
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "Somente ADMIN pode alterar a automação." },
      { status: 403 },
    );
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Informe enabled e intervalMinutes (5 a 1440). COMMIT automático não é configurável." },
      { status: 400 },
    );
  }

  const { config, changed } = await prisma.$transaction(async (tx) => {
    await tx.autonomousGovernanceAutomationConfig.upsert({
      where: { organizationId: organization.id },
      update: {},
      create: {
        organizationId: organization.id,
        enabled: false,
        intervalMinutes: 5,
        commitEnabled: false,
      },
    });

    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "AutonomousGovernanceAutomationConfig"
        WHERE "organizationId" = ${organization.id} FOR UPDATE`,
    );

    const previous = await tx.autonomousGovernanceAutomationConfig.findUniqueOrThrow({
      where: { organizationId: organization.id },
    });
    const changed =
      previous.enabled !== parsed.data.enabled ||
      previous.intervalMinutes !== parsed.data.intervalMinutes ||
      previous.commitEnabled;

    if (!changed) return { config: previous, changed: false };

    const config = await tx.autonomousGovernanceAutomationConfig.update({
      where: { organizationId: organization.id },
      data: {
        enabled: parsed.data.enabled,
        intervalMinutes: parsed.data.intervalMinutes,
        commitEnabled: false,
      },
    });

    await tx.autonomousGovernanceAutomationConfigChange.create({
      data: {
        organizationId: organization.id,
        actorUserId: session.user.id,
        previousEnabled: previous.enabled,
        enabled: config.enabled,
        previousIntervalMinutes: previous.intervalMinutes,
        intervalMinutes: config.intervalMinutes,
        previousCommitEnabled: previous.commitEnabled,
        commitEnabled: false,
      },
    });

    return { config, changed: true };
  });

  return NextResponse.json(
    { ok: true, changed, config },
    { headers: { "Cache-Control": "no-store" } },
  );
}
