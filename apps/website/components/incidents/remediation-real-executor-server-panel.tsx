import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { RemediationRealExecutorPanel } from "@/components/incidents/remediation-real-executor-panel";

function envTrue(name: string, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

export async function RemediationRealExecutorServerPanel({
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
      action: "START_VM",
    },
    orderBy: { approvedAt: "desc" },
  });

  if (!plan) return null;

  const authorization =
    await prisma.remediationExecutionAuthorization.findFirst({
      where: {
        organizationId: organization.id,
        incidentId,
        planId: plan.id,
      },
      orderBy: { issuedAt: "desc" },
    });

  return (
    <RemediationRealExecutorPanel
      incidentId={incidentId}
      planId={plan.id}
      action={plan.action}
      authorizationId={authorization?.id ?? null}
      authorizationStatus={authorization?.status ?? null}
      expiresAt={authorization?.expiresAt.toISOString() ?? null}
      assetName={authorization?.assetName ?? null}
      nodeName={authorization?.nodeName ?? null}
      enabled={envTrue("HOIWORK_REAL_START_VM_EXECUTOR_ENABLED", false)}
    />
  );
}
