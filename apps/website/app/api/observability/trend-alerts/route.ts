import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const { organization } = await requireOrganization();

  const alerts = await prisma.notificationSloTrendAlert.findMany({
    where: { organizationId: organization.id },
    orderBy: [
      { status: "asc" },
      { severity: "asc" },
      { lastSeenAt: "desc" },
    ],
  });

  return NextResponse.json({ ok: true, alerts });
}
