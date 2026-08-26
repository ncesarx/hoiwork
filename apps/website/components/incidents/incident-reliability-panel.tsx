import { requireOrganization } from "@/lib/authz";
import { buildIncidentReliability } from "@/lib/incidents/incident-reliability";

function fmtMinutes(value: number | null) {
  if (value === null) return "N/D";
  if (value < 60) return `${value.toFixed(2)} min`;
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  return `${h}h ${m}m`;
}

function fmtPct(value: number | null) {
  return value === null ? "N/D" : `${value.toFixed(2)}%`;
}

export async function IncidentReliabilityPanel() {
  const { organization } = await requireOrganization();
  const data = await buildIncidentReliability(organization.id, 30);

  return (
    <section className="incident-reliability-panel">
      <div className="incident-reliability-heading">
        <div>
          <span>Sprint 015.6.11.3</span>
          <h2>Incident SLA, MTTA & MTTR</h2>
          <p>
            Confiabilidade operacional baseada no ciclo real dos incidentes e
            SLAs por severidade.
          </p>
        </div>
        <div className="incident-reliability-period">
          <strong>30d</strong>
          <small>{data.counters.total} incidentes</small>
        </div>
      </div>

      <div className="incident-reliability-kpis">
        <article>
          <span>MTTA</span>
          <strong>{fmtMinutes(data.metrics.mttaMinutes)}</strong>
        </article>
        <article>
          <span>MTTR</span>
          <strong>{fmtMinutes(data.metrics.mttrMinutes)}</strong>
        </article>
        <article>
          <span>Resolution SLA</span>
          <strong>{fmtPct(data.metrics.resolutionSlaCompliance)}</strong>
        </article>
        <article>
          <span>Active SLA Breaches</span>
          <strong>
            {data.counters.acknowledgeBreaches + data.counters.resolutionBreaches}
          </strong>
        </article>
      </div>

      <div className="incident-reliability-grid">
        <section>
          <header>
            <span>Active Breaches</span>
            <h3>Incidentes fora de SLA</h3>
          </header>

          {data.activeBreaches.map((row) => (
            <article key={row.id}>
              <div>
                <b>{row.severity}</b>
                <strong>{row.title}</strong>
                <small>{row.assetName} · {row.site ?? "N/D"}</small>
              </div>
              <span>age {fmtMinutes(row.ageMinutes)}</span>
              <span>
                {row.acknowledgeBreached ? "ACK BREACH" : ""}
                {row.resolveBreached ? " RESOLVE BREACH" : ""}
              </span>
              <em>{row.status}</em>
            </article>
          ))}

          {!data.activeBreaches.length ? (
            <div className="incident-reliability-empty">
              Nenhum breach ativo.
            </div>
          ) : null}
        </section>

        <section>
          <header>
            <span>Recent Resolved</span>
            <h3>Resoluções recentes</h3>
          </header>

          {data.recentResolved.map((row) => (
            <article key={row.id}>
              <div>
                <b>{row.severity}</b>
                <strong>{row.title}</strong>
                <small>{row.assetName}</small>
              </div>
              <span>MTTR {fmtMinutes(row.mttrMinutes)}</span>
              <span>SLA {row.sla.resolve} min</span>
              <em>
                {row.mttrMinutes !== null && row.mttrMinutes <= row.sla.resolve
                  ? "WITHIN SLA"
                  : "BREACHED"}
              </em>
            </article>
          ))}

          {!data.recentResolved.length ? (
            <div className="incident-reliability-empty">
              Nenhuma resolução no período.
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
