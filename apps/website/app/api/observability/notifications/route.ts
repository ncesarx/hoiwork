import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { buildNotificationObservability } from "@/lib/observability/notification-slo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { organization } = await requireOrganization();
    const data = await buildNotificationObservability(organization.id);

    return NextResponse.json(
      { ok: true, ...data },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-HOIWORK-Observability": "015.6.10.1",
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
            : "Falha ao construir observabilidade.",
      },
      { status: 500 },
    );
  }
}
