import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { buildSloReport } from "@/lib/observability/slo-reporting";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { organization } = await requireOrganization();
  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? 30);
  const report = await buildSloReport(organization.id, days);
  return NextResponse.json({ ok: true, report }, {
    headers: { "Cache-Control": "no-store", "X-HOIWORK-SLO-Report": "015.6.10.5" },
  });
}
