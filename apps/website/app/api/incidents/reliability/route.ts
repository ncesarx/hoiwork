import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { buildIncidentReliability } from "@/lib/incidents/incident-reliability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { organization } = await requireOrganization();
  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? 30);

  const data = await buildIncidentReliability(organization.id, days);

  return NextResponse.json(
    { ok: true, ...data },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-HOIWORK-Incident-Reliability": "015.6.11.3",
      },
    },
  );
}
