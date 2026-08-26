import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { revokeExecutionAuthorization } from "@/lib/incidents/remediation-authorization";

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

  if (!authorizationId) {
    return NextResponse.json(
      { ok: false, error: "authorizationId obrigatório." },
      { status: 400 },
    );
  }

  try {
    const authorization = await revokeExecutionAuthorization({
      organizationId: organization.id,
      incidentId: id,
      planId,
      authorizationId,
      reason: typeof body.reason === "string" ? body.reason : null,
      session,
    });

    return NextResponse.json({
      ok: true,
      message: "Autorização revogada.",
      authorization,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao revogar.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("Somente ADMIN") ? 403 : 400 },
    );
  }
}
