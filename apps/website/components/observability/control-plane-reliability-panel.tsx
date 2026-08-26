import { requireOrganization } from "@/lib/authz";
import { buildControlPlaneReliabilityDashboard } from "@/lib/observability/control-plane-reliability-dashboard";

function pct(value: number | null) {
  return value === null ? "N/D" : `${value.toFixed(2)}%`;
}

function burn(value: number | null) {
  return value === null ? "N/D" : `${value.toFixed(2)}x`;
}

export async function ControlPlaneReliabilityPanel() {
  const { organization } = await requireOrganization();

  const data = await buildControlPlaneReliabilityDashboard(
    organization.id,
  );

  return (
    <section className="control-plane-reliability-panel">
      <div className="control-plane-reliability-heading">
        <div>
          <span>Sprint 015.6.11.7.3.5</span>
          <h2>Control Plane Reliability & Audit</h2>
          <p>
            Consolida Self-Health, SLO, error budget, burn rate e histórico
            auditável do próprio HOIWORK.
          </p>
        </div>

        <div className={`control-plane-reliability-state is-${data.health.state.toLowerCase()}`}>
          <small>Current State</small>
          <strong>{data.health.state}</strong>
          <em>{data.health.score ?? "N/D"}/100 · {data.health.confidence}</em>
        </div>
      </div>

      <div className="control-plane-reliability-kpis">
        <article>
          <span>Availability 24h</span>
          <strong>{pct(data.slo.availability)}</strong>
          <small>Target {pct(data.slo.target)}</small>
        </article>
        <article>
          <span>Error Budget</span>
          <strong>{pct(data.slo.errorBudgetPercent)}</strong>
          <small>{data.slo.sampleCount} snapshots</small>
        </article>
        <article>
          <span>Burn Rate</span>
          <strong>{burn(data.slo.burnRate)}</strong>
          <small>{data.slo.burnState}</small>
        </article>
        <article>
          <span>Recovery</span>
          <strong>{data.health.recovery.state}</strong>
          <small>{data.health.recovery.consecutiveDiscoveryFailures} discovery failures</small>
        </article>
      </div>

      <div className="control-plane-reliability-grid">
        <section>
          <header>
            <span>Self-Health Incidents</span>
            <strong>{data.selfHealth.open} OPEN</strong>
          </header>
          <dl>
            <div><dt>Resolved</dt><dd>{data.selfHealth.resolved}</dd></div>
            <div><dt>MTTR</dt><dd>{data.selfHealth.mttrMinutes === null ? "N/D" : `${data.selfHealth.mttrMinutes} min`}</dd></div>
            <div><dt>Last incident</dt><dd>{data.selfHealth.lastIncident?.title ?? "NONE"}</dd></div>
            <div><dt>Status</dt><dd>{data.selfHealth.lastIncident?.status ?? "NONE"}</dd></div>
          </dl>
        </section>

        <section>
          <header>
            <span>SLO Automation</span>
            <strong>{data.slo.lastAutomationRun?.status ?? "NO_DATA"}</strong>
          </header>
          <dl>
            <div><dt>Source</dt><dd>{data.slo.lastAutomationRun?.source ?? "N/D"}</dd></div>
            <div><dt>Run ID</dt><dd>{data.slo.lastAutomationRun?.id ?? "N/D"}</dd></div>
            <div><dt>Last error</dt><dd>{data.slo.lastAutomationRun?.errorMessage ?? "NONE"}</dd></div>
            <div><dt>Evaluated</dt><dd>{data.evaluatedAt.toLocaleString("pt-BR")}</dd></div>
          </dl>
        </section>
      </div>

      <div className="control-plane-reliability-runs">
        <span>Recent SLO Automation Runs</span>
        <div>
          {data.recentAutomationRuns.map((run) => (
            <article key={run.id}>
              <header>
                <strong>{run.status}</strong>
                <small>{run.source}</small>
              </header>
              <dl>
                <div><dt>Availability</dt><dd>{pct(run.availability)}</dd></div>
                <div><dt>Error budget</dt><dd>{pct(run.errorBudgetPercent)}</dd></div>
                <div><dt>Burn</dt><dd>{burn(run.burnRate)}</dd></div>
                <div><dt>Burn state</dt><dd>{run.burnState ?? "N/D"}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </div>

      <div className="control-plane-reliability-audit">
        <span>Self-Health Audit Timeline</span>

        {data.auditTimeline.length === 0 ? (
          <p>Nenhum evento self-health registrado.</p>
        ) : (
          <div>
            {data.auditTimeline.map((event) => (
              <article key={event.id}>
                <time>{event.createdAt.toLocaleString("pt-BR")}</time>
                <strong>{event.eventType}</strong>
                <p>{event.message}</p>
                <small>
                  {event.fromStatus ?? "—"} → {event.toStatus ?? "—"}
                </small>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
