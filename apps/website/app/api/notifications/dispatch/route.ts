import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { dispatchAlertDeliveries } from "@/lib/notifications/dispatcher";

export const dynamic = "force-dynamic";

export async function POST() {
  const { session, organization } = await requireOrganization();
  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
  }
  try {
    const result = await dispatchAlertDeliveries(organization.id);
    return NextResponse.json({ ok: true, message: `${result.processed} entrega(s) processada(s).`, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha no dispatcher." }, { status: 500 });
  }
}
