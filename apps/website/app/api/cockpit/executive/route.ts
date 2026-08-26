import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { buildExecutiveCockpit } from "@/lib/cockpit/executive-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { organization } = await requireOrganization();
    const data = await buildExecutiveCockpit(organization.id);

    return NextResponse.json(
      { ok: true, ...data },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-HOIWORK-Cockpit": "015.6.11",
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
            : "Falha ao montar Executive Cockpit.",
      },
      { status: 500 },
    );
  }
}
