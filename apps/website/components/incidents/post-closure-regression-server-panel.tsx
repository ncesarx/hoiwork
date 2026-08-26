import { requireOrganization } from "@/lib/authz";
import { buildPostClosureRegressionStatus } from "@/lib/incidents/post-closure-regression";
import { PostClosureRegressionPanel } from "@/components/incidents/post-closure-regression-panel";

export async function PostClosureRegressionServerPanel({
  incidentId,
}: {
  incidentId: string;
}) {
  const { organization } = await requireOrganization();
  const data = await buildPostClosureRegressionStatus(
    organization.id,
    incidentId,
  );

  if (!data) return null;

  return <PostClosureRegressionPanel data={data} />;
}
