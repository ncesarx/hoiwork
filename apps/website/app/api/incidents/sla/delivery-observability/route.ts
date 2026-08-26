import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { buildSlaDeliveryObservability } from "@/lib/incidents/sla-delivery-observability";

export const dynamic = "force-dynamic";

export async function GET() {
  const { organization } = await requireOrganization();

  const data = await buildSlaDeliveryObservability(organization.id, 100);

  return NextResponse.json(
    { ok: true, ...data },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-HOIWORK-SLA-Delivery-Observability": "015.6.11.3.3",
      },
    },
  );
}
