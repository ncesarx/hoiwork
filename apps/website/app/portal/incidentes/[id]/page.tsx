import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/authz";
import { getIncidentForOrganization } from "@/lib/incidents/lifecycle";
import { IncidentCommandCenter } from "@/components/incidents/incident-command-center";
import { RemediationIntelligencePanel } from "@/components/incidents/remediation-intelligence-panel";
import { RemediationPlanServerPanel } from "@/components/incidents/remediation-plan-server-panel";
import { RemediationExecutorServerPanel } from "@/components/incidents/remediation-executor-server-panel";
import { RemediationVerificationServerPanel } from "@/components/incidents/remediation-verification-server-panel";
import { RemediationGovernanceServerPanel } from "@/components/incidents/remediation-governance-server-panel";
import { RemediationAuthorizationServerPanel } from "@/components/incidents/remediation-authorization-server-panel";
import { RemediationApprovalRenewalServerPanel } from "@/components/incidents/remediation-approval-renewal-server-panel";
import { RemediationRealExecutorServerPanel } from "@/components/incidents/remediation-real-executor-server-panel";
import { PostRemediationAssuranceServerPanel } from "@/components/incidents/post-remediation-assurance-server-panel";
import { PostRemediationStabilityServerPanel } from "@/components/incidents/post-remediation-stability-server-panel";
import { PostRemediationClosureServerPanel } from "@/components/incidents/post-remediation-closure-server-panel";
import { PostClosureRegressionServerPanel } from "@/components/incidents/post-closure-regression-server-panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { organization } = await requireOrganization();
  const { id } = await params;
  const incident = await getIncidentForOrganization(organization.id, id);

  if (!incident) notFound();

  return (
    <>
      <section className="portal-heading">
        <span>Incident Command Center</span>
        <h1>{incident.title}</h1>
        <p>
          {incident.site || "SITE"} · {incident.instanceName || "Proxmox"} · {incident.assetType} · {incident.assetName}
        </p>
      </section>

      <IncidentCommandCenter
        organizationId={organization.id}
        incidentId={incident.id}
      />

      <RemediationIntelligencePanel incidentId={incident.id} />

      <RemediationPlanServerPanel incidentId={incident.id} />

      <RemediationApprovalRenewalServerPanel incidentId={incident.id} />

      <RemediationExecutorServerPanel incidentId={incident.id} />

      <RemediationVerificationServerPanel incidentId={incident.id} />

      <PostRemediationAssuranceServerPanel incidentId={incident.id} />

      <PostRemediationStabilityServerPanel incidentId={incident.id} />

      <PostRemediationClosureServerPanel incidentId={incident.id} />

      <PostClosureRegressionServerPanel incidentId={incident.id} />

      <RemediationGovernanceServerPanel incidentId={incident.id} />

      <RemediationAuthorizationServerPanel incidentId={incident.id} />

      <RemediationRealExecutorServerPanel incidentId={incident.id} />
    </>
  );
}
