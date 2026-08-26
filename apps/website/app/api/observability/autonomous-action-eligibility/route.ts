import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { evaluateAutonomousActionEligibility } from "@/lib/governance/autonomous-action-eligibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { organization } = await requireOrganization();

  const result = await evaluateAutonomousActionEligibility(
    organization.id,
  );

  return NextResponse.json(
    {
      ok: true,
      ...result,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-HOIWORK-Autonomous-Eligibility": "015.6.11.7.4.1",
      },
    },
  );
}
