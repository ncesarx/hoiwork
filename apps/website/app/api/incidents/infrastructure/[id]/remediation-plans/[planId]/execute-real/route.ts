import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { executeAuthorizedStartVm } from "@/lib/incidents/remediation-real-executor";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; planId: string }> },
) {
  const { session, organization } = await requireOrganization();
  const { id, planId } = await context.params;
  const body = await request.json().catch(() => ({}));

  const authorizationId =
    typeof body.authorizationId === "string"
      ? body.authorizationId.trim()
      : "";

  const confirmation =
    typeof body.confirmation === "string"
      ? body.confirmation.trim()
      : "";

  if (!authorizationId) {
    return NextResponse.json(
      { ok: false, error: "authorizationId obrigatório." },
      { status: 400 },
    );
  }

  try {
    const result = await executeAuthorizedStartVm({
      organizationId: organization.id,
      incidentId: id,
      planId,
      authorizationId,
      confirmation,
      session,
    });

    return NextResponse.json({
      ok: true,
      message:
        "START_VM real enviado ao Proxmox. Execute Discovery e Verification imediatamente.",
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Falha no executor real.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("Somente ADMIN") ? 403 : 400 },
    );
  }
}
