import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { RemediationExecutorPanel } from "@/components/incidents/remediation-executor-panel";

export async function RemediationExecutorServerPanel({
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

  const runs = await prisma.remediationExecutionRun.findMany({
    where: {
      organizationId: organization.id,
      incidentId,
      planId: plan.id,
    },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  return (
    <RemediationExecutorPanel
      incidentId={incidentId}
      planId={plan.id}
      planStatus={plan.status}
      action={plan.action}
      runs={runs.map((run) => ({
        id: run.id,
        mode: run.mode,
        status: run.status,
        executor: run.executor,
        durationMs: run.durationMs,
        errorMessage: run.errorMessage,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
      }))}
    />
  );
}
