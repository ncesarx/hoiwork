import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { RemediationVerificationPanel } from "@/components/incidents/remediation-verification-panel";

export async function RemediationVerificationServerPanel({
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

  const [execution, verifications] = await Promise.all([
    prisma.remediationExecutionRun.findFirst({
      where: {
        organizationId: organization.id,
        incidentId,
        planId: plan.id,
        status: "COMPLETED",
      },
      orderBy: { startedAt: "desc" },
    }),
    prisma.remediationVerificationRun.findMany({
      where: {
        organizationId: organization.id,
        incidentId,
        planId: plan.id,
      },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <RemediationVerificationPanel
      incidentId={incidentId}
      planId={plan.id}
      action={plan.action}
      executionCompleted={Boolean(execution)}
      verifications={verifications.map((item) => ({
        id: item.id,
        mode: item.mode,
        status: item.status,
        verificationState: item.verificationState,
        rollbackReadiness: item.rollbackReadiness,
        expectedState: item.expectedState,
        observedState: item.observedState,
        durationMs: item.durationMs,
        errorMessage: item.errorMessage,
        startedAt: item.startedAt.toISOString(),
        finishedAt: item.finishedAt?.toISOString() ?? null,
      }))}
    />
  );
}
