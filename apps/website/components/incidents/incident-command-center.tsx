import Link from "next/link";
import { IncidentLifecycleActions } from "@/components/incidents/incident-lifecycle-actions";
import { buildIncidentCommandCenter } from "@/lib/incidents/incident-command-center";

function fmtAge(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${mins}m`;
}

export async function IncidentCommandCenter({
  organizationId,
  incidentId,
}: {
  organizationId: string;
  incidentId: string;
}) {
  const data = await buildIncidentCommandCenter(organizationId, incidentId);
  if (!data) return null;

  const { incident, asset } = data;

  return (
    <>
      <section className="incident-command-hero">
        <div>
          <span>Sprint 015.6.11.4</span>
          <h2>Incident Command Center</h2>
          <p>
            Workstation operacional unificada para lifecycle, SLA, delivery,
            infraestrutura e decisão assistida.
          </p>
        </div>
        <div className={`incident-command-next is-${data.recommendation.action.toLowerCase()}`}>
          <span>Next Recommended Action</span>
          <strong>{data.recommendation.label}</strong>
          <small>{data.recommendation.reason}</small>
        </div>
      </section>

      <section className="incident-command-kpis">
        <article><span>Status</span><strong>{incident.status}</strong></article>
        <article><span>Severity</span><strong>{incident.severity}</strong></article>
        <article><span>Risk</span><strong>{incident.riskScore}</strong></article>
        <article><span>Blast Radius</span><strong>{incident.blastRadius}</strong></article>
        <article><span>Age</span><strong>{fmtAge(data.ageMinutes)}</strong></article>
        <article><span>SLA Breaches</span><strong>{data.sla.open}</strong></article>
        <article><span>Delivery Health</span><strong>{data.delivery.health}</strong></article>
        <article><span>Recovery Evidence</span><strong>{data.recoveryEvidence}</strong></article>
      </section>

      <section className="incident-command-grid">
        <article className="incident-command-card">
          <span>Operational State</span>
          <h3>Ownership & Lifecycle</h3>
          <dl>
            <div><dt>Responsável</dt><dd>{incident.assignedToName ?? "NÃO ATRIBUÍDO"}</dd></div>
            <div><dt>Acknowledged</dt><dd>{incident.acknowledgedAt ? incident.acknowledgedAt.toLocaleString("pt-BR") : "PENDENTE"}</dd></div>
            <div><dt>ACK por</dt><dd>{incident.acknowledgedByName ?? "—"}</dd></div>
            <div><dt>Atribuído em</dt><dd>{incident.assignedAt ? incident.assignedAt.toLocaleString("pt-BR") : "—"}</dd></div>
          </dl>
        </article>

        <article className="incident-command-card">
          <span>Infrastructure</span>
          <h3>Current Asset State</h3>
          <dl>
            <div><dt>Asset</dt><dd>{incident.assetName}</dd></div>
            <div><dt>Tipo</dt><dd>{incident.assetType}</dd></div>
            <div><dt>Status atual</dt><dd>{asset?.status ?? "N/D"}</dd></div>
            <div><dt>Último discovery</dt><dd>{asset?.lastSeenAt ? asset.lastSeenAt.toLocaleString("pt-BR") : "N/D"}</dd></div>
          </dl>
        </article>

        <article className="incident-command-card">
          <span>SLA Intelligence</span>
          <h3>Operational Pressure</h3>
          <dl>
            <div><dt>Breaches ativos</dt><dd>{data.sla.open}</dd></div>
            <div><dt>ACK breach</dt><dd>{data.sla.ack}</dd></div>
            <div><dt>Resolution breach</dt><dd>{data.sla.resolution}</dd></div>
            <div><dt>Último breach</dt><dd>{data.sla.lastDetectedAt ? data.sla.lastDetectedAt.toLocaleString("pt-BR") : "—"}</dd></div>
          </dl>
        </article>

        <article className="incident-command-card">
          <span>Notification Delivery</span>
          <h3>Communication Health</h3>
          <dl>
            <div><dt>Total</dt><dd>{data.delivery.total}</dd></div>
            <div><dt>SENT</dt><dd>{data.delivery.sent}</dd></div>
            <div><dt>Pending / Retry</dt><dd>{data.delivery.pending}</dd></div>
            <div><dt>FAILED</dt><dd>{data.delivery.failed}</dd></div>
          </dl>
          <Link href="/portal/incidentes/sla/delivery">Abrir Delivery Observability</Link>
        </article>
      </section>

      <section className="incident-command-actions">
        <div>
          <span>Operational Workflow</span>
          <h3>Incident Actions</h3>
        </div>
        <IncidentLifecycleActions
          id={incident.id}
          status={incident.status}
          assignedToName={incident.assignedToName}
        />
      </section>

      <section className="incident-command-timeline">
        <div className="incident-command-section-heading">
          <span>Unified Audit Trail</span>
          <h3>Operational Timeline</h3>
        </div>
        {data.timeline.map((item) => (
          <article key={item.id}>
            <i />
            <div>
              <header><b>{item.type}</b><time>{item.at.toLocaleString("pt-BR")}</time></header>
              <p>{item.message}</p>
              <small>{item.actor || "Sistema"}</small>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
