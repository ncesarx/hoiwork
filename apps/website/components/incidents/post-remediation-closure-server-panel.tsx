import { requireOrganization } from "@/lib/authz";
import { evaluateGovernedAutonomousClosure } from "@/lib/incidents/post-remediation-closure";
import { PostRemediationClosurePanel } from "@/components/incidents/post-remediation-closure-panel";

export async function PostRemediationClosureServerPanel({
  incidentId,
}: {
  incidentId: string;
}) {
  const { session, organization } = await requireOrganization();

  const data = await evaluateGovernedAutonomousClosure(
    organization.id,
    incidentId,
  );

  if (!data) return null;

  return (
    <PostRemediationClosurePanel
      incidentId={incidentId}
      data={data}
      canClose={session.user.role === "ADMIN"}
    />
  );
}
