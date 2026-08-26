import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { RemediationGovernancePanel } from "@/components/incidents/remediation-governance-panel";

export async function RemediationGovernanceServerPanel({
  incidentId,
}: {
  incidentId: string;
}) {
  const { organization } = await requireOrganization();

  const plan = await prisma.remediationExecutionPlan.findFirst({
    where: {
      organizationId: organization.id,
      incidentId,
      status: "APPROVED",
    },
    orderBy: { approvedAt: "desc" },
  });

  if (!plan) return null;

  const evaluations =
    await prisma.remediationGovernanceEvaluation.findMany({
      where: {
        organizationId: organization.id,
        incidentId,
        planId: plan.id,
      },
      orderBy: { evaluatedAt: "desc" },
      take: 20,
    });

  return (
    <RemediationGovernancePanel
      incidentId={incidentId}
      planId={plan.id}
      action={plan.action}
      planStatus={plan.status}
      evaluations={evaluations.map((item) => ({
        id: item.id,
        decision: item.decision,
        policyVersion: item.policyVersion,
        eligibleForRealExecution: item.eligibleForRealExecution,
        realExecutionStillBlocked: item.realExecutionStillBlocked,
        blockers: item.blockers,
        warnings: item.warnings,
        evaluatedByName: item.evaluatedByName,
        evaluatedAt: item.evaluatedAt.toISOString(),
      }))}
    />
  );
}
