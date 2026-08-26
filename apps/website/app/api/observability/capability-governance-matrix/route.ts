import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { evaluateCapabilityGovernanceMatrix } from "@/lib/governance/capability-governance-matrix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { organization } = await requireOrganization();

  const result = await evaluateCapabilityGovernanceMatrix(
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
        "X-HOIWORK-Capability-Governance": "015.6.11.7.4.2",
      },
    },
  );
}
