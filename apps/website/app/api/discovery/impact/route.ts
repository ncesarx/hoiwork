import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import {
  buildImpactIntelligence,
  getAssetImpact,
} from "@/lib/discovery/impact-intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { organization } = await requireOrganization();
    const url = new URL(request.url);
    const externalId = url.searchParams.get("externalId");

    if (externalId) {
      const impact = await getAssetImpact(organization.id, externalId);

      return NextResponse.json(
        { ok: true, generatedAt: new Date().toISOString(), impact },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const intelligence = await buildImpactIntelligence(organization.id);

    return NextResponse.json(
      {
        ok: true,
        generatedAt: new Date().toISOString(),
        ...intelligence,
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-HOIWORK-Impact": "015.6.5",
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
            : "Erro ao calcular inteligência de impacto.",
      },
      { status: 500 },
    );
  }
}
