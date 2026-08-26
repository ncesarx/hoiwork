import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { authorizeExecutionPreflight } from "@/lib/incidents/remediation-authorization";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; planId: string }> },
) {
  const { session, organization } = await requireOrganization();
  const { id, planId } = await context.params;

  try {
    const result = await authorizeExecutionPreflight({
      organizationId: organization.id,
      incidentId: id,
      planId,
      session,
    });

    return NextResponse.json({
      ok: true,
      message:
        "Preflight aprovado e autorização temporária emitida. Execução real permanece BLOQUEADA.",
      authorization: result.authorization,
      tokenPreview: result.tokenPreview,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha no preflight.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("Somente ADMIN") ? 403 : 400 },
    );
  }
}
