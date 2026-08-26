import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const { organization } = await requireOrganization();

  const [openEscalations, runs] = await Promise.all([
    prisma.incidentSlaEscalation.findMany({
      where: { organizationId: organization.id, status: "OPEN" },
      include: { incident: true },
      orderBy: { detectedAt: "desc" },
      take: 50,
    }),
    prisma.incidentSlaEvaluationRun.findMany({
      where: { organizationId: organization.id },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({ ok: true, openEscalations, runs });
}
