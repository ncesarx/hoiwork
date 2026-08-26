import { requireOrganization } from "@/lib/authz";
import { buildPostRemediationAssurance } from "@/lib/incidents/post-remediation-assurance";
import { PostRemediationAssurancePanel } from "@/components/incidents/post-remediation-assurance-panel";

export async function PostRemediationAssuranceServerPanel({
  incidentId,
}: {
  incidentId: string;
}) {
  const { organization } = await requireOrganization();
  const data = await buildPostRemediationAssurance(organization.id, incidentId);

  if (!data) return null;

  return <PostRemediationAssurancePanel data={data} />;
}
