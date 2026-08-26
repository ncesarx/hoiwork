export function PostClosureRegressionPanel({
  data,
}: {
  data: {
    version: string;
    incidentStatus: string;
    managedClosure: boolean;
    monitoringState: string;
    regressionDetected: boolean;
    asset: null | {
      name: string;
      status: string;
      active: boolean;
      freshnessMinutes: number | null;
    };
    recurrence: null | {
      id: string;
      status: string;
      source: string;
    };
  };
}) {
  return (
    <section className="post-closure-regression-panel">
      <div className="post-closure-regression-heading">
        <div>
          <span>Sprint {data.version}</span>
          <h3>Post-Closure Regression Guard</h3>
          <p>
            Monitora incidentes fechados pelo Post-Remediation Assurance e
            detecta regressão sem reabrir o ciclo anterior.
          </p>
        </div>
        <div className={`post-closure-state is-${data.monitoringState.toLowerCase()}`}>
          <span>Monitoring State</span>
          <strong>{data.monitoringState}</strong>
        </div>
      </div>

      <div className="post-closure-regression-kpis">
        <article><span>Managed closure</span><strong>{data.managedClosure ? "YES" : "NO"}</strong></article>
        <article><span>Incident</span><strong>{data.incidentStatus}</strong></article>
        <article><span>Asset</span><strong>{data.asset?.status ?? "NO_DATA"}</strong></article>
        <article><span>Regression</span><strong>{data.regressionDetected ? "YES" : "NO"}</strong></article>
      </div>

      <div className="post-closure-regression-grid">
        <section>
          <span>Asset Evidence</span>
          <dl>
            <div><dt>Name</dt><dd>{data.asset?.name ?? "N/D"}</dd></div>
            <div><dt>Status</dt><dd>{data.asset?.status ?? "N/D"}</dd></div>
            <div><dt>Active</dt><dd>{data.asset?.active ? "YES" : "NO"}</dd></div>
            <div><dt>Freshness</dt><dd>{data.asset?.freshnessMinutes ?? "N/D"} min</dd></div>
          </dl>
        </section>
        <section>
          <span>Recurrence</span>
          <dl>
            <div><dt>Incident</dt><dd>{data.recurrence?.id ?? "NONE"}</dd></div>
            <div><dt>Status</dt><dd>{data.recurrence?.status ?? "NONE"}</dd></div>
            <div><dt>Source</dt><dd>{data.recurrence?.source ?? "NONE"}</dd></div>
          </dl>
        </section>
      </div>
    </section>
  );
}
