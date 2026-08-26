import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { verifyRemediationPlan } from "@/lib/incidents/remediation-verification";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; planId: string }> },
) {
  const { session, organization } = await requireOrganization();
  const { id, planId } = await context.params;

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json(
      { ok: false, error: "Acesso negado." },
      { status: 403 },
    );
  }

  try {
    const result = await verifyRemediationPlan({
      organizationId: organization.id,
      incidentId: id,
      planId,
      session,
    });

    return NextResponse.json({
      ok: true,
      message: result.reused
        ? "Verificação anterior reutilizada."
        : "Verificação concluída. Rollback apenas avaliado; nenhuma ação executada.",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha na verificação.",
      },
      { status: 400 },
    );
  }
}
