import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function DiscoveryLifecyclePanel() {
  const { organization } = await requireOrganization();

  const [discoveryConfig, runs] = await Promise.all([
    prisma.discoveryAutomationConfig.findUnique({
      where: { organizationId: organization.id },
    }),
    prisma.incidentReconciliationRun.findMany({
      where: {
        organizationId: organization.id,
        source: "DISCOVERY",
      },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
  ]);

  const last = runs[0] ?? null;

  return (
    <section className="discovery-lifecycle-panel">
      <div className="discovery-lifecycle-heading">
        <div>
          <span>Sprint 015.6.11.2.1</span>
          <h2>Discovery-triggered Reconciliation</h2>
          <p>
            Closed-loop lifecycle: somente um Discovery totalmente COMPLETED
            pode produzir evidência automática de recuperação.
          </p>
        </div>

        <div className="discovery-lifecycle-status">
          <strong>
            {discoveryConfig?.enabled ? "ACTIVE" : "INACTIVE"}
          </strong>
          <small>
            Discovery {discoveryConfig?.intervalMinutes ?? "N/D"} min
          </small>
        </div>
      </div>

      <div className="discovery-lifecycle-kpis">
        <article>
          <span>Auto reconciliation runs</span>
          <strong>{runs.length}</strong>
        </article>
        <article>
          <span>Último status</span>
          <strong>{last?.status ?? "N/D"}</strong>
        </article>
        <article>
          <span>Último inspected</span>
          <strong>{last?.inspected ?? 0}</strong>
        </article>
        <article>
          <span>Último resolved</span>
          <strong>{last?.resolved ?? 0}</strong>
        </article>
      </div>

      <div className="discovery-lifecycle-history">
        <div>
          <span>Closed-loop Audit Trail</span>
          <h3>Discovery → Reconciliation</h3>
        </div>

        {runs.map((run) => (
          <article key={run.id}>
            <div>
              <b>{run.status}</b>
              <strong>{run.id}</strong>
              <small>{run.startedAt.toLocaleString("pt-BR")}</small>
            </div>
            <span>
              discovery {run.discoveryAutomationRunId ?? "N/D"}
            </span>
            <span>{run.inspected} inspected</span>
            <span>{run.keptOpen} kept</span>
            <span>{run.resolved} resolved</span>
            <span>{run.errors} errors</span>
          </article>
        ))}

        {!runs.length ? (
          <div className="discovery-lifecycle-empty">
            Aguardando o próximo Discovery automático COMPLETED.
          </div>
        ) : null}
      </div>
    </section>
  );
}
