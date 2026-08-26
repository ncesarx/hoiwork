import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { getAutonomousGovernanceStatus } from "@/lib/governance/autonomous-recovery-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { organization } = await requireOrganization();

  const result = await getAutonomousGovernanceStatus(
    organization.id,
  );

  return NextResponse.json(
    { ok: true, ...result },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-HOIWORK-Autonomous-Recovery-Audit":
          "015.6.11.7.4.4",
      },
    },
  );
}
