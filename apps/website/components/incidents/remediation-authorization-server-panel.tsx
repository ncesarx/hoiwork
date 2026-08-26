import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { RemediationAuthorizationPanel } from "@/components/incidents/remediation-authorization-panel";

export async function RemediationAuthorizationServerPanel({
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

  if (!plan) return null;

  const [governance, authorizations] = await Promise.all([
    prisma.remediationGovernanceEvaluation.findFirst({
      where: {
        organizationId: organization.id,
        incidentId,
        planId: plan.id,
      },
      orderBy: { evaluatedAt: "desc" },
    }),
    prisma.remediationExecutionAuthorization.findMany({
      where: {
        organizationId: organization.id,
        incidentId,
        planId: plan.id,
      },
      orderBy: { issuedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <RemediationAuthorizationPanel
      incidentId={incidentId}
      planId={plan.id}
      action={plan.action}
      governanceDecision={governance?.decision ?? "NOT_EVALUATED"}
      canAuthorize={session.user.role === "ADMIN"}
      authorizations={authorizations.map((item) => ({
        id: item.id,
        status: item.status,
        action: item.action,
        assetName: item.assetName,
        nodeName: item.nodeName,
        issuedAt: item.issuedAt.toISOString(),
        expiresAt: item.expiresAt.toISOString(),
        issuedByName: item.issuedByName,
        revokedAt: item.revokedAt?.toISOString() ?? null,
        revokeReason: item.revokeReason,
      }))}
    />
  );
}
