import { requireOrganization } from "@/lib/authz";
import { buildExecutiveCockpit } from "@/lib/cockpit/executive-health";

function cls(state: string) {
  return `executive-state executive-state--${state.toLowerCase().replace("_","-")}`;
}

function pct(value: number | null) {
  return value === null ? "N/D" : `${value.toFixed(2)}%`;
}

export async function ExecutiveCockpit() {
  const { organization } = await requireOrganization();
  const data = await buildExecutiveCockpit(organization.id);

  return (
    <section className="executive-cockpit">
      <div className="executive-cockpit__heading">
        <div>
          <span>Sprint 015.6.11</span>
          <h2>Executive Operations Cockpit</h2>
          <p>
            Visão convergente de infraestrutura, incidentes, risco, notificações,
            automação e SLO operacional.
          </p>
        </div>

        <div className={cls(data.state)}>
          <small>Executive Health</small>
          <strong>
            {data.executiveScore === null ? "N/D" : `${data.executiveScore}/100`}
          </strong>
          <em>{data.state}</em>
        </div>
      </div>

      <div className="executive-component-grid">
        <article>
          <span>Infrastructure</span>
          <strong>{data.components.infrastructure ?? "N/D"}</strong>
        </article>
        <article>
          <span>Incidents</span>
          <strong>{data.components.incidents ?? "N/D"}</strong>
        </article>
        <article>
          <span>Notifications</span>
          <strong>{data.components.notifications ?? "N/D"}</strong>
        </article>
        <article>
          <span>Freshness</span>
          <strong>{data.components.freshness ?? "N/D"}</strong>
        </article>
      </div>

      <div className="executive-domain-grid">
        <section>
          <header><span>Infrastructure</span><h3>Multi-Site Estate</h3></header>
          <dl>
            <div><dt>Proxmox</dt><dd>{data.infrastructure.proxmoxHealthy}/{data.infrastructure.proxmoxTotal} healthy</dd></div>
            <div><dt>Assets ativos</dt><dd>{data.infrastructure.activeAssets}</dd></div>
            <div><dt>Sites</dt><dd>{data.infrastructure.sites}</dd></div>
            <div><dt>Freshness máximo</dt><dd>{data.infrastructure.maxFreshnessAgeMinutes ?? "N/D"} min</dd></div>
          </dl>
        </section>

        <section>
          <header><span>Incident Intelligence</span><h3>Operational Risk</h3></header>
          <dl>
            <div><dt>OPEN</dt><dd>{data.incidents.openTotal}</dd></div>
            <div><dt>CRITICAL</dt><dd>{data.incidents.critical}</dd></div>
            <div><dt>HIGH</dt><dd>{data.incidents.high}</dd></div>
            <div><dt>Max Risk</dt><dd>{data.incidents.maxRisk}</dd></div>
          </dl>
        </section>

        <section>
          <header><span>Notification SLO</span><h3>Reliability</h3></header>
          <dl>
            <div><dt>NOC Health</dt><dd>{data.notifications.nocHealthScore ?? "N/D"}/100</dd></div>
            <div><dt>Burn Rate 1h</dt><dd>{data.notifications.burnRate1h ?? "N/D"}x</dd></div>
            <div><dt>Error Budget 24h</dt><dd>{pct(data.notifications.errorBudget24h)}</dd></div>
            <div><dt>Automation</dt><dd>{data.notifications.automationEnabled ? "ENABLED" : "DISABLED"}</dd></div>
          </dl>
        </section>
      </div>

      <section className="executive-incidents">
        <div className="executive-incidents__heading">
          <span>Top Operational Risks</span>
          <h3>Incidentes prioritários</h3>
        </div>

        {data.incidents.top.map((incident) => (
          <article key={incident.id}>
            <div>
              <b>{incident.severity}</b>
              <strong>{incident.title}</strong>
              <small>{incident.assetName} · {incident.assetType}</small>
            </div>
            <span>risk {incident.riskScore}</span>
            <span>blast {incident.blastRadius}</span>
            <span>{incident.site ?? "N/D"}</span>
            <em>{incident.status}</em>
          </article>
        ))}

        {!data.incidents.top.length ? (
          <div className="executive-empty">Nenhum incidente aberto.</div>
        ) : null}
      </section>

      <div className="executive-footnote">
        <span>
          SLO snapshot: {data.slo.latestSnapshotAt
            ? data.slo.latestSnapshotAt.toLocaleString("pt-BR")
            : "N/D"}
        </span>
        <span>
          Automation last success: {data.notifications.automationLastSuccessAt
            ? data.notifications.automationLastSuccessAt.toLocaleString("pt-BR")
            : "N/D"}
        </span>
      </div>
    </section>
  );
}
