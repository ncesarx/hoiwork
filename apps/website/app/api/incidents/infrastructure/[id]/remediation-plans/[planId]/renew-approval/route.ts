import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { renewRemediationApproval } from "@/lib/incidents/remediation-approval-renewal";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; planId: string }> },
) {
  const { session, organization } = await requireOrganization();
  const { id, planId } = await context.params;
  const body = await request.json().catch(() => ({}));

  try {
    const result = await renewRemediationApproval({
      organizationId: organization.id,
      incidentId: id,
      planId,
      reason: typeof body.reason === "string" ? body.reason : null,
      session,
    });

    return NextResponse.json({
      ok: true,
      message: result.renewed
        ? "Aprovação renovada. Execute novamente a avaliação de governança."
        : "A aprovação ainda está dentro da janela de freshness.",
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Falha ao renovar aprovação.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("Somente ADMIN") ? 403 : 400 },
    );
  }
}
