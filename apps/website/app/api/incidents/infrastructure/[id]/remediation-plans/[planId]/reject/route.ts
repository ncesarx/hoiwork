import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { decidePlan } from "@/lib/incidents/remediation-plans";

export async function POST(request: Request, context: { params: Promise<{ id: string; planId: string }> }) {
  const { session, organization } = await requireOrganization();
  const { id, planId } = await context.params;
  const body = await request.json().catch(() => ({}));
  try {
    const plan = await decidePlan({
      organizationId: organization.id,
      incidentId: id,
      planId,
      approve: false,
      reason: typeof body.reason === "string" ? body.reason : null,
      session,
    });
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao rejeitar plano.";
    return NextResponse.json({ ok: false, error: message }, { status: message.includes("Somente ADMIN") ? 403 : 400 });
  }
}
