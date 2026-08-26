import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { IncidentSlaConsole } from "@/components/incidents/incident-sla-console";

export async function IncidentSlaPanel() {
  const { organization } = await requireOrganization();

  const [openEscalations, runs] = await Promise.all([
    prisma.incidentSlaEscalation.findMany({
      where: { organizationId: organization.id, status: "OPEN" },
      include: { incident: true },
      orderBy: { detectedAt: "desc" },
      take: 50,
    }),
    prisma.incidentSlaEvaluationRun.findMany({
      where: { organizationId: organization.id },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
  ]);

  const ack = openEscalations.filter((e) => e.breachType === "ACK_SLA_BREACH").length;
  const resolution = openEscalations.filter((e) => e.breachType === "RESOLUTION_SLA_BREACH").length;
  const last = runs[0];

  return (
    <section className="incident-sla-panel">
      <div className="incident-sla-heading">
        <div>
          <span>Sprint 015.6.11.3.2</span>
          <h2>SLA Breach Engine & Automated Escalation</h2>
          <p>
            Avaliação idempotente de SLA, criação de escalonamentos e reutilização
            do Notification Engine via AlertDelivery PENDING.
          </p>
        </div>
      </div>

      <div className="incident-sla-kpis">
        <article><span>ACK breaches</span><strong>{ack}</strong></article>
        <article><span>Resolution breaches</span><strong>{resolution}</strong></article>
        <article><span>Open escalations</span><strong>{openEscalations.length}</strong></article>
        <article><span>Last errors</span><strong>{last?.errors ?? 0}</strong></article>
      </div>

      <IncidentSlaConsole />

      <div className="incident-sla-list">
        <div><span>Active Escalations</span><h3>SLA fora do prazo</h3></div>
        {openEscalations.map((item) => (
          <article key={item.id}>
            <div>
              <b>{item.breachType}</b>
              <strong>{item.incident.title}</strong>
              <small>{item.incident.assetName} · {item.incident.site ?? "N/D"}</small>
            </div>
            <span>{item.severity}</span>
            <span>{item.detectedAt.toLocaleString("pt-BR")}</span>
            <em>{item.status}</em>
          </article>
        ))}
        {!openEscalations.length ? <div className="incident-sla-empty">Nenhum escalonamento ativo.</div> : null}
      </div>
    </section>
  );
}
