import { requireOrganization } from "@/lib/authz";
import { buildPostRemediationStability } from "@/lib/incidents/post-remediation-stability";
import { PostRemediationStabilityPanel } from "@/components/incidents/post-remediation-stability-panel";

export async function PostRemediationStabilityServerPanel({
  incidentId,
}: {
  incidentId: string;
}) {
  const { organization } = await requireOrganization();
  const data = await buildPostRemediationStability(organization.id, incidentId);

  if (!data) return null;

  return <PostRemediationStabilityPanel data={data} />;
}
