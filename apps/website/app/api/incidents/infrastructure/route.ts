import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { organization } = await requireOrganization();

  const incidents = await prisma.infrastructureIncident.findMany({
    where: { organizationId: organization.id },
    orderBy: [
      { status: "asc" },
      { riskScore: "desc" },
      { lastSeenAt: "desc" },
    ],
  });

  return NextResponse.json(
    { ok: true, incidents },
    { headers: { "Cache-Control": "no-store" } },
  );
}
