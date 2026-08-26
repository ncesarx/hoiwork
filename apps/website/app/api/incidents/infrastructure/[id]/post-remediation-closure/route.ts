import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import {
  evaluateGovernedAutonomousClosure,
  executeGovernedAutonomousClosure,
} from "@/lib/incidents/post-remediation-closure";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { organization } = await requireOrganization();
  const { id } = await context.params;

  const data = await evaluateGovernedAutonomousClosure(
    organization.id,
    id,
  );

  if (!data) {
    return NextResponse.json(
      { ok: false, error: "Incidente não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { ok: true, ...data },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-HOIWORK-Post-Remediation-Closure": "015.6.11.6.4.3",
      },
    },
  );
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { session, organization } = await requireOrganization();
  const { id } = await context.params;

  try {
    const result = await executeGovernedAutonomousClosure({
      organizationId: organization.id,
      incidentId: id,
      session,
    });

    return NextResponse.json({
      ok: true,
      message: "Incidente fechado por Post-Remediation Assurance.",
      incidentId: result.incident.id,
      status: result.incident.status,
      resolvedAt: result.incident.resolvedAt,
      evaluation: result.evaluation,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha no auto-closure.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("Somente ADMIN") ? 403 : 400 },
    );
  }
}
