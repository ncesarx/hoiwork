import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { evaluateRemediationGovernance } from "@/lib/incidents/remediation-governance";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { organization } = await requireOrganization();
  const { id } = await context.params;

  const evaluations = await prisma.remediationGovernanceEvaluation.findMany({
    where: {
      organizationId: organization.id,
      incidentId: id,
    },
    orderBy: { evaluatedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ ok: true, evaluations });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { session, organization } = await requireOrganization();
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const planId =
    typeof body.planId === "string" ? body.planId.trim() : "";

  if (!planId) {
    return NextResponse.json(
      { ok: false, error: "planId obrigatório." },
      { status: 400 },
    );
  }

  try {
    const result = await evaluateRemediationGovernance({
      organizationId: organization.id,
      incidentId: id,
      planId,
      session,
    });

    return NextResponse.json({
      ok: true,
      message:
        `Governança concluída: ${result.evaluation.decision}. ` +
        "Execução real permanece BLOQUEADA.",
      evaluation: result.evaluation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha na avaliação de governança.",
      },
      { status: 400 },
    );
  }
}
