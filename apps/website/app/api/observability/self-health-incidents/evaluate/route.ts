import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import {
  evaluateSelfHealthIncidents,
  reconcileSelfHealthIncidents,
} from "@/lib/incidents/self-health-incident-engine";

export async function GET() {
  const { organization } = await requireOrganization();

  const data = await evaluateSelfHealthIncidents(
    organization.id,
  );

  return NextResponse.json(
    { ok: true, ...data },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-HOIWORK-Self-Health-Incidents": "015.6.11.7.3.1",
      },
    },
  );
}

export async function POST(request: Request) {
  const { session, organization } = await requireOrganization();

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "Somente ADMIN pode executar reconciliação self-health." },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const commit = url.searchParams.get("commit") === "1";

  const data = await reconcileSelfHealthIncidents({
    organizationId: organization.id,
    commit,
  });

  return NextResponse.json(
    { ok: true, ...data },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-HOIWORK-Self-Health-Incidents": "015.6.11.7.3.1",
      },
    },
  );
}
