import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { buildSiteHealth } from "@/lib/cockpit/site-health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { organization } = await requireOrganization();
    const sites = await buildSiteHealth(organization.id);

    return NextResponse.json(
      { ok: true, sites },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-HOIWORK-Site-Health": "015.6.11.1",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha ao calcular Site Health.",
      },
      { status: 500 },
    );
  }
}
