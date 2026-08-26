import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { getRetentionGovernance } from "@/lib/observability/slo-governance";

export const dynamic = "force-dynamic";

export async function GET() {
  const { organization } = await requireOrganization();
  const data = await getRetentionGovernance(organization.id);

  return NextResponse.json(
    { ok: true, ...data },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-HOIWORK-SLO-Retention": "015.6.10.6",
      },
    },
  );
}
