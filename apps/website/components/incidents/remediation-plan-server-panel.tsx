import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { RemediationPlanPanel } from "@/components/incidents/remediation-plan-panel";

export async function RemediationPlanServerPanel({
  incidentId,
}: {
  incidentId: string;
}) {
  const { session, organization } = await requireOrganization();

  const plans = await prisma.remediationExecutionPlan.findMany({
    where: {
      organizationId: organization.id,
      incidentId,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const serialized = plans.map((plan) => ({
    id: plan.id,
    action: plan.action,
    safetyClass: plan.safetyClass,
    status: plan.status,
    risk: plan.risk,
    rationale: plan.rationale,
    requiresApproval: plan.requiresApproval,
    realExecutionEnabled: plan.realExecutionEnabled,
    executableNow: plan.executableNow,
    createdByName: plan.createdByName,
    createdAt: plan.createdAt.toISOString(),
    submittedAt: plan.submittedAt?.toISOString() ?? null,
    approvedAt: plan.approvedAt?.toISOString() ?? null,
    approvedByName: plan.approvedByName,
    rejectedAt: plan.rejectedAt?.toISOString() ?? null,
    rejectedByName: plan.rejectedByName,
    rejectionReason: plan.rejectionReason,
    expiresAt: plan.expiresAt?.toISOString() ?? null,
  }));

  return (
    <RemediationPlanPanel
      incidentId={incidentId}
      initialPlans={serialized}
      canApprove={session.user.role === "ADMIN"}
    />
  );
}
