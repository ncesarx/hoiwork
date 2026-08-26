import { requireOrganization } from "@/lib/authz";
import { buildSiteHealth } from "@/lib/cockpit/site-health";

function cls(state: string) {
  return `site-health-state site-health-state--${state.toLowerCase().replace("_","-")}`;
}

export async function SiteHealthPanel() {
  const { organization } = await requireOrganization();
  const sites = await buildSiteHealth(organization.id);

  return (
    <section className="site-health-panel">
      <div className="site-health-heading">
        <div>
          <span>Sprint 015.6.11.1</span>
          <h2>Executive Drill-Down & Site Health</h2>
          <p>
            Decomposição do cockpit por site, instância Proxmox, freshness e risco operacional.
          </p>
        </div>
        <div className="site-health-count">
          <strong>{sites.length}</strong>
          <small>sites</small>
        </div>
      </div>

      <div className="site-health-grid">
        {sites.map((site) => (
          <article key={site.displayName} className="site-health-card">
            <header>
              <div>
                <span>Site</span>
                <h3>{site.displayName}</h3>
              </div>
              <div className={cls(site.state)}>
                <strong>{site.siteScore ?? "N/D"}</strong>
                <small>{site.state}</small>
              </div>
            </header>

            <div className="site-health-kpis">
              <div><span>Proxmox</span><strong>{site.infrastructure.healthyInstances}/{site.infrastructure.instances}</strong></div>
              <div><span>Assets</span><strong>{site.infrastructure.assets}</strong></div>
              <div><span>Incidents</span><strong>{site.incidents.total}</strong></div>
              <div><span>Max Risk</span><strong>{site.incidents.maxRisk}</strong></div>
            </div>

            <dl>
              <div><dt>CRITICAL</dt><dd>{site.incidents.critical}</dd></div>
              <div><dt>HIGH</dt><dd>{site.incidents.high}</dd></div>
              <div><dt>MEDIUM</dt><dd>{site.incidents.medium}</dd></div>
              <div><dt>Freshness</dt><dd>{site.infrastructure.maxFreshnessAgeMinutes ?? "N/D"} min</dd></div>
            </dl>

            <section className="site-instance-list">
              <span>Proxmox Instances</span>
              {site.instances.map((instance) => (
                <div key={instance.id}>
                  <strong>{instance.name}</strong>
                  <em>{instance.status}</em>
                  <small>
                    {instance.lastSyncAt
                      ? instance.lastSyncAt.toLocaleString("pt-BR")
                      : "Sem sync"}
                  </small>
                </div>
              ))}
            </section>

            {site.topIncidents.length ? (
              <section className="site-risk-list">
                <span>Top Risks</span>
                {site.topIncidents.map((incident) => (
                  <div key={incident.id}>
                    <b>{incident.severity}</b>
                    <strong>{incident.title}</strong>
                    <small>risk {incident.riskScore}</small>
                  </div>
                ))}
              </section>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
