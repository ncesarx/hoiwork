import { requireOrganization } from "@/lib/authz";
import { getRetentionGovernance } from "@/lib/observability/slo-governance";
import { RetentionGovernanceConsole } from "@/components/observability/retention-governance-console";

export async function RetentionGovernancePanel() {
  const { organization } = await requireOrganization();
  const data = await getRetentionGovernance(organization.id);

  return (
    <section className="retention-governance-panel">
      <div className="retention-governance-heading">
        <div>
          <span>Sprint 015.6.10.6</span>
          <h2>Automated Retention & SLO Governance</h2>
          <p>
            Retenção automática diária integrada ao SLO Automation, com janela
            configurável e auditoria do último cleanup.
          </p>
        </div>
        <div className="retention-status">
          <strong>{data.config.enabled ? "ENABLED" : "DISABLED"}</strong>
          <small>{data.config.retentionDays} dias</small>
        </div>
      </div>

      <RetentionGovernanceConsole
        enabled={data.config.enabled}
        retentionDays={data.config.retentionDays}
      />

      <div className="retention-kpis">
        <article>
          <span>Snapshots</span>
          <strong>{data.totalSnapshots}</strong>
        </article>
        <article>
          <span>Mais antigo</span>
          <strong>
            {data.oldestSnapshotAt
              ? data.oldestSnapshotAt.toLocaleString("pt-BR")
              : "N/D"}
          </strong>
        </article>
        <article>
          <span>Mais recente</span>
          <strong>
            {data.newestSnapshotAt
              ? data.newestSnapshotAt.toLocaleString("pt-BR")
              : "N/D"}
          </strong>
        </article>
        <article>
          <span>Último cleanup</span>
          <strong>
            {data.config.lastCleanupAt
              ? data.config.lastCleanupAt.toLocaleString("pt-BR")
              : "Nunca"}
          </strong>
          <small>{data.config.lastDeletedCount} removido(s)</small>
        </article>
      </div>
    </section>
  );
}
