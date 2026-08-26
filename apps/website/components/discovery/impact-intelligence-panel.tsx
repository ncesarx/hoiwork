import { buildImpactIntelligence } from "@/lib/discovery/impact-intelligence";
import { requireOrganization } from "@/lib/authz";

function riskClass(risk: string) {
  if (risk === "CRITICAL") return "risk-critical";
  if (risk === "HIGH") return "risk-high";
  if (risk === "MEDIUM") return "risk-medium";
  return "risk-low";
}

export async function ImpactIntelligencePanel() {
  const { organization } = await requireOrganization();
  const intelligence = await buildImpactIntelligence(organization.id);

  return (
    <section className="impact-intelligence">
      <div className="impact-intelligence__heading">
        <div>
          <span>Sprint 015.6.5</span>
          <h2>Impact & Dependency Intelligence</h2>
          <p>
            Blast radius, criticidade e dependências calculadas a partir da
            topologia multi-site registrada no HOIWORK.
          </p>
        </div>
        <div className="impact-intelligence__summary">
          <strong>{intelligence.totals.dependencies}</strong>
          <small>dependências</small>
          <strong>{intelligence.totals.criticalNodes}</strong>
          <small>nodes críticos</small>
        </div>
      </div>

      <div className="impact-intelligence__kpis">
        <article><span>Sites</span><strong>{intelligence.totals.sites}</strong></article>
        <article><span>Nodes</span><strong>{intelligence.totals.nodes}</strong></article>
        <article><span>Dependências</span><strong>{intelligence.totals.dependencies}</strong></article>
        <article><span>Dependências degradadas</span><strong>{intelligence.totals.unhealthyDependencies}</strong></article>
        <article><span>High Risk</span><strong>{intelligence.totals.highRiskNodes}</strong></article>
        <article><span>Critical</span><strong>{intelligence.totals.criticalNodes}</strong></article>
      </div>

      <div className="impact-site-grid">
        {intelligence.sites.map((site) => (
          <article key={site.instance.id} className="impact-site-card">
            <header>
              <div>
                <span>{site.instance.site || "SITE"}</span>
                <h3>{site.instance.name}</h3>
                <small>{site.instance.baseUrl}</small>
              </div>
              <b className={riskClass(site.risk)}>{site.risk}</b>
            </header>

            <div className="impact-site-score">
              <span>Site Risk Score</span>
              <strong>{site.score}</strong>
            </div>

            <div className="impact-node-list">
              {site.nodes.map((node) => (
                <details key={node.externalId}>
                  <summary>
                    <div>
                      <b>{node.name}</b>
                      <small>{node.status}</small>
                    </div>
                    <span>Blast radius: {node.blastRadius}</span>
                    <span>Score: {node.score}</span>
                    <strong className={riskClass(node.risk)}>{node.risk}</strong>
                  </summary>

                  <div className="impact-dependency-list">
                    {node.dependents.map((asset) => (
                      <div key={asset.externalId}>
                        <b>{asset.assetType}</b>
                        <span>{asset.name}</span>
                        <small>{asset.status}</small>
                      </div>
                    ))}
                    {!node.dependents.length ? (
                      <small>Nenhuma dependência direta.</small>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
