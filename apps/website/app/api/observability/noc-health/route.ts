import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { buildNocHealthModel } from "@/lib/observability/noc-health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { organization } = await requireOrganization();
    const data = await buildNocHealthModel(organization.id);

    return NextResponse.json(
      { ok: true, ...data },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-HOIWORK-NOC-Health": "015.6.10.2",
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
            : "Falha no NOC Health Model.",
      },
      { status: 500 },
    );
  }
}
