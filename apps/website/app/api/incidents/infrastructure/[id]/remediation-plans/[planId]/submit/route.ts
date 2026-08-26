import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { submitPlan } from "@/lib/incidents/remediation-plans";

export async function POST(_request: Request, context: { params: Promise<{ id: string; planId: string }> }) {
  const { session, organization } = await requireOrganization();
  const { id, planId } = await context.params;
  try {
    const plan = await submitPlan({ organizationId: organization.id, incidentId: id, planId, session });
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao submeter plano." }, { status: 400 });
  }
}
