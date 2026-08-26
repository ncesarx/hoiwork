import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { executePlanSimulated } from "@/lib/incidents/remediation-executor";

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
    const result = await executePlanSimulated({
      organizationId: organization.id,
      incidentId: id,
      planId,
      session,
    });

    return NextResponse.json({
      ok: true,
      message: result.reused
        ? "Execução simulada anterior reutilizada."
        : "Execução SIMULATED concluída. Nenhuma mutação real realizada.",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha na execução simulada.",
      },
      { status: 400 },
    );
  }
}
