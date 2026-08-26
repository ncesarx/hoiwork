import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { createPlan } from "@/lib/incidents/remediation-plans";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { organization } = await requireOrganization();
  const { id } = await context.params;
  const plans = await prisma.remediationExecutionPlan.findMany({
    where: { organizationId: organization.id, incidentId: id },
    include: { approvals: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ ok: true, plans });
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { session, organization } = await requireOrganization();
  const { id } = await context.params;
  try {
    const plan = await createPlan({ organizationId: organization.id, incidentId: id, session });
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao criar plano." }, { status: 400 });
  }
}
