import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { governAlertDeliveries } from "@/lib/notifications/governance";
import { dispatchAlertDeliveries } from "@/lib/notifications/dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
  }

  try {
    const governance = await governAlertDeliveries(organization.id);
    const dispatch = await dispatchAlertDeliveries(organization.id);

    return NextResponse.json({
      ok: true,
      message:
        `Governance: maintenance=${governance.heldMaintenance}, cooldown=${governance.heldCooldown}, ` +
        `released=${governance.released}. Dispatcher: sent=${dispatch.sent}, retry=${dispatch.retryPending}, failed=${dispatch.failed}.`,
      governance,
      dispatch,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha na automação." },
      { status: 500 },
    );
  }
}
