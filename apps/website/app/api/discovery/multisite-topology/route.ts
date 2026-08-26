import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { buildMultiSiteTopology } from "@/lib/discovery/multisite-topology";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { organization } = await requireOrganization();
    const topology = await buildMultiSiteTopology(organization.id);

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      ...topology,
    }, {
      headers: {
        "Cache-Control": "no-store",
        "X-HOIWORK-Topology": "015.6.4.2",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao construir topologia multi-site.",
      },
      { status: 500 },
    );
  }
}
