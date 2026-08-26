import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { buildControlPlaneHealth } from "@/lib/observability/control-plane-health";

export async function GET() {
  const { organization } = await requireOrganization();

  const health = await buildControlPlaneHealth(
    organization.id,
  );

  return NextResponse.json(
    {
      ok: true,
      ...health,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-HOIWORK-Control-Plane-Health": "015.6.11.7.1",
      },
    },
  );
}
