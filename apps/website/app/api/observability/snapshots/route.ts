import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { getSloTrend } from "@/lib/observability/slo-snapshots";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { organization } = await requireOrganization();
    const data = await getSloTrend(organization.id);
    return NextResponse.json(
      { ok: true, ...data },
      { headers: { "Cache-Control": "no-store", "X-HOIWORK-SLO-Trend": "015.6.10.3" } },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao carregar tendência." },
      { status: 500 },
    );
  }
}
