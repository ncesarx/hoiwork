import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { IncidentReconciliationConsole } from "@/components/incidents/incident-reconciliation-console";

export async function IncidentReconciliationPanel() {
  const { organization } = await requireOrganization();

  const [open, acknowledged, resolved, runs] = await Promise.all([
    prisma.infrastructureIncident.count({
      where: { organizationId: organization.id, status: "OPEN" },
    }),
    prisma.infrastructureIncident.count({
      where: { organizationId: organization.id, status: "ACKNOWLEDGED" },
    }),
    prisma.infrastructureIncident.count({
      where: { organizationId: organization.id, status: "RESOLVED" },
    }),
    prisma.incidentReconciliationRun.findMany({
      where: { organizationId: organization.id },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <section className="incident-reconciliation-panel">
      <div className="incident-reconciliation-heading">
        <div>
          <span>Sprint 015.6.11.2</span>
          <h2>Incident Lifecycle & Automated Reconciliation</h2>
          <p>
            Reconciliação conservadora: ativo fresco + saudável precisa ser
            observado em dois ciclos consecutivos antes de RESOLVED.
          </p>
        </div>
      </div>

      <div className="incident-reconciliation-kpis">
        <article><span>OPEN</span><strong>{open}</strong></article>
        <article><span>ACKNOWLEDGED</span><strong>{acknowledged}</strong></article>
        <article><span>RESOLVED</span><strong>{resolved}</strong></article>
        <article><span>Evidence required</span><strong>2</strong></article>
      </div>

      <IncidentReconciliationConsole />

      <div className="incident-reconciliation-history">
        <div>
          <span>Reconciliation Runs</span>
          <h3>Audit Trail</h3>
        </div>

        {runs.map((run) => (
          <article key={run.id}>
            <div>
              <b>{run.source}</b>
              <strong>{run.status}</strong>
              <small>{run.startedAt.toLocaleString("pt-BR")}</small>
            </div>
            <span>{run.inspected} inspected</span>
            <span>{run.keptOpen} kept</span>
            <span>{run.resolved} resolved</span>
            <span>{run.skipped} skipped</span>
            <span>{run.durationMs ?? 0} ms</span>
          </article>
        ))}

        {!runs.length ? (
          <div className="incident-reconciliation-empty">
            Nenhuma reconciliação executada.
          </div>
        ) : null}
      </div>
    </section>
  );
}
