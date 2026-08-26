import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { RemediationApprovalRenewalPanel } from "@/components/incidents/remediation-approval-renewal-panel";

export async function RemediationApprovalRenewalServerPanel({
  incidentId,
}: {
  incidentId: string;
}) {
  const { session, organization } = await requireOrganization();

  const plan = await prisma.remediationExecutionPlan.findFirst({
    where: {
      organizationId: organization.id,
      incidentId,
      status: "APPROVED",
    },
    orderBy: { approvedAt: "desc" },
  });

  if (!plan?.approvedAt) return null;

  const maxAgeMinutes = Number(
    process.env.HOIWORK_REMEDIATION_APPROVAL_MAX_AGE_MINUTES ?? "60",
  );

  return (
    <RemediationApprovalRenewalPanel
      incidentId={incidentId}
      planId={plan.id}
      action={plan.action}
      approvedAt={plan.approvedAt.toISOString()}
      approvedByName={plan.approvedByName}
      expiresAt={plan.expiresAt?.toISOString() ?? null}
      maxAgeMinutes={maxAgeMinutes}
      canRenew={session.user.role === "ADMIN"}
    />
  );
}
