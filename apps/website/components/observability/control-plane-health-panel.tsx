import { requireOrganization } from "@/lib/authz";
import { buildControlPlaneHealth } from "@/lib/observability/control-plane-health";

function stateClass(state: string) {
  return `control-plane-state control-plane-state--${state.toLowerCase()}`;
}

function score(value: number | null) {
  return value === null ? "N/D" : `${value}/100`;
}

function freshness(value: number | null) {
  return value === null ? "N/D" : `${value} min`;
}

export async function ControlPlaneHealthPanel() {
  const { organization } = await requireOrganization();
  const data = await buildControlPlaneHealth(organization.id);

  const domains = [
    {
      key: "discovery",
      label: "Discovery",
      data: data.domains.discovery,
      detail: `${String(data.domains.discovery.evidence.succeeded ?? "N/D")}/${String(
        data.domains.discovery.evidence.instancesTotal ?? "N/D",
      )} instâncias`,
    },
    {
      key: "proxmox",
      label: "Proxmox",
      data: data.domains.proxmox,
      detail: `${String(data.domains.proxmox.evidence.healthy ?? "N/D")}/${String(
        data.domains.proxmox.evidence.total ?? "N/D",
      )} healthy`,
    },
    {
      key: "reconciliation",
      label: "Reconciliation",
      data: data.domains.reconciliation,
      detail: `Run ${String(data.domains.reconciliation.evidence.latestStatus ?? "N/D")}`,
    },
    {
      key: "incidentAutomation",
      label: "Incident Automation",
      data: data.domains.incidentAutomation,
      detail: `Run ${String(data.domains.incidentAutomation.evidence.latestStatus ?? "N/D")}`,
    },
    {
      key: "notifications",
      label: "Notifications",
      data: data.domains.notifications,
      detail: `NOC ${String(data.domains.notifications.evidence.nocHealthScore ?? "N/D")}/100`,
    },
    {
      key: "slo",
      label: "SLO",
      data: data.domains.slo,
      detail: `NOC ${String(data.domains.slo.evidence.nocHealthScore ?? "N/D")}/100`,
    },
  ];

  return (
    <section className="control-plane-health-panel">
      <div className="control-plane-health-heading">
        <div>
          <span>Sprint 015.6.11.7.1</span>
          <h2>Control Plane Health Intelligence</h2>
          <p>
            Saúde consolidada do próprio HOIWORK, correlacionando Discovery,
            Proxmox, Reconciliation, automação de incidentes, Notifications e SLO.
          </p>
        </div>

        <div className={stateClass(data.state)}>
          <small>Control Plane</small>
          <strong>{data.state}</strong>
          <em>{score(data.score)} · {data.confidence}</em>
        </div>
      </div>

      <div className="control-plane-kpis">
        <article>
          <span>Overall Score</span>
          <strong>{score(data.score)}</strong>
        </article>
        <article>
          <span>Confidence</span>
          <strong>{data.confidence}</strong>
        </article>
        <article>
          <span>Recovery</span>
          <strong>{data.recovery.state}</strong>
        </article>
        <article>
          <span>Blockers</span>
          <strong>{data.blockers.length}</strong>
        </article>
      </div>

      <div className="control-plane-domain-grid">
        {domains.map((domain) => (
          <article key={domain.key} className="control-plane-domain-card">
            <header>
              <div>
                <span>{domain.label}</span>
                <strong>{score(domain.data.score)}</strong>
              </div>
              <div className={stateClass(domain.data.state)}>
                <strong>{domain.data.state}</strong>
                <small>{domain.data.confidence}</small>
              </div>
            </header>

            <dl>
              <div>
                <dt>Freshness</dt>
                <dd>{freshness(domain.data.freshnessMinutes)}</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>{domain.detail}</dd>
              </div>
              <div>
                <dt>Blockers</dt>
                <dd>{domain.data.blockers.length}</dd>
              </div>
              <div>
                <dt>Warnings</dt>
                <dd>{domain.data.warnings.length}</dd>
              </div>
            </dl>

            {domain.data.blockers.length > 0 ? (
              <div className="control-plane-domain-flags is-blocker">
                {domain.data.blockers.map((item) => <b key={item}>{item}</b>)}
              </div>
            ) : null}

            {domain.data.warnings.length > 0 ? (
              <div className="control-plane-domain-flags is-warning">
                {domain.data.warnings.map((item) => <b key={item}>{item}</b>)}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {data.rootCauses.length > 0 ? (
        <div className="control-plane-root-causes">
          <span>Root Cause Intelligence</span>
          <div className="control-plane-root-causes-grid">
            {data.rootCauses.map((cause, index) => (
              <article
                key={`${cause.instanceId ?? "unknown"}-${cause.reason}-${index}`}
                className="control-plane-root-cause-card"
              >
                <header>
                  <div>
                    <b>{cause.reason}</b>
                    <strong>{cause.instanceName ?? cause.domain}</strong>
                    <em>{cause.site ?? cause.domain}</em>
                  </div>
                  <div className={`control-plane-state control-plane-state--${cause.severity === "CRITICAL" ? "critical" : "degraded"}`}>
                    <strong>{cause.category}</strong>
                    <small>{cause.severity}</small>
                  </div>
                </header>

                <dl>
                  <div><dt>Retryable</dt><dd>{cause.retryable ? "YES" : "NO"}</dd></div>
                  <div><dt>Recoverable</dt><dd>{cause.recoverable ? "YES" : "NO"}</dd></div>
                  <div><dt>Raw error</dt><dd>{cause.rawMessage ?? "N/D"}</dd></div>
                </dl>

                <p>{cause.recommendedAction}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {data.blockedCapabilities.length > 0 ? (
        <div className="control-plane-global-flags">
          <section>
            <span>Blocked capabilities</span>
            <div>
              {data.blockedCapabilities.map((item) => <b key={item}>{item}</b>)}
            </div>
          </section>
        </div>
      ) : null}

      <div className="control-plane-recovery">
        <div>
          <span>Control Plane Recovery</span>
          <h3>{data.recovery.state}</h3>
        </div>

        <dl>
          <div>
            <dt>Last failure</dt>
            <dd>
              {data.recovery.lastFailureAt
                ? data.recovery.lastFailureAt.toLocaleString("pt-BR")
                : "N/D"}
            </dd>
          </div>
          <div>
            <dt>Last success</dt>
            <dd>
              {data.recovery.lastSuccessAt
                ? data.recovery.lastSuccessAt.toLocaleString("pt-BR")
                : "N/D"}
            </dd>
          </div>
          <div>
            <dt>Discovery failures</dt>
            <dd>{data.recovery.consecutiveDiscoveryFailures}</dd>
          </div>
          <div>
            <dt>Evaluated at</dt>
            <dd>{data.evaluatedAt.toLocaleString("pt-BR")}</dd>
          </div>
        </dl>
      </div>

      {data.blockers.length || data.warnings.length ? (
        <div className="control-plane-global-flags">
          {data.blockers.length ? (
            <section>
              <span>Global blockers</span>
              <div>{data.blockers.map((item) => <b key={item}>{item}</b>)}</div>
            </section>
          ) : null}

          {data.warnings.length ? (
            <section>
              <span>Global warnings</span>
              <div>{data.warnings.map((item) => <b key={item}>{item}</b>)}</div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="control-plane-clean">
          Nenhum blocker ou warning ativo no Control Plane.
        </div>
      )}
    </section>
  );
}
