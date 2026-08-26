import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const { organization } = await requireOrganization();

  const [open, acknowledged, resolved, runs] = await Promise.all([
    prisma.infrastructureIncident.count({
      where: { organizationId: organization.id, status: "OPEN" },
    }),
    prisma.infrastructureIncident.count({
      where: { organizationId: organization.id, status: "ACKNOWLEDGED" },
    }),
    prisma.infrastructureIncident.count({
      where: { organizationId: organization.id, status: "RESOLVED" },
    }),
    prisma.incidentReconciliationRun.findMany({
      where: { organizationId: organization.id },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    ok: true,
    counters: { open, acknowledged, resolved },
    runs,
  });
}
