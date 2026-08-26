export function PostRemediationStabilityPanel({
  data,
}: {
  data: {
    version: string;
    stabilityState: string;
    evidenceCount: number;
    requiredEvidenceCount: number;
    stableForSeconds: number;
    minimumStableSeconds: number;
    intervalMinutes: number;
    closureReady: boolean;
    closureEligible: boolean;
    blockers: string[];
    observability: {
      enabled: boolean;
      consecutiveFailures: number;
      lastError: string | null;
      warnings: string[];
    };
  };
}) {
  return (
    <section className="post-remediation-stability-panel">
      <div className="post-remediation-stability-heading">
        <div>
          <span>Sprint {data.version}</span>
          <h3>Recovery Stability Window & Confidence Gate</h3>
          <p>
            Exige múltiplas evidências saudáveis independentes ao longo do tempo.
            Esta etapa nunca altera o status do incidente.
          </p>
        </div>
        <div className={`stability-state is-${data.stabilityState.toLowerCase()}`}>
          <span>Stability State</span>
          <strong>{data.stabilityState}</strong>
        </div>
      </div>

      <div className="post-remediation-stability-kpis">
        <article><span>Evidence</span><strong>{data.evidenceCount}/{data.requiredEvidenceCount}</strong></article>
        <article><span>Stable for</span><strong>{data.stableForSeconds}s</strong></article>
        <article><span>Minimum</span><strong>{data.minimumStableSeconds}s</strong></article>
        <article><span>Closure ready</span><strong>{data.closureReady ? "YES" : "NO"}</strong></article>
      </div>

      <div className="post-remediation-stability-grid">
        <section>
          <span>Policy</span>
          <h4>Janela de estabilidade</h4>
          <dl>
            <div><dt>Discovery cadence</dt><dd>{data.intervalMinutes} min</dd></div>
            <div><dt>Required observations</dt><dd>{data.requiredEvidenceCount}</dd></div>
            <div><dt>Minimum elapsed</dt><dd>{data.minimumStableSeconds}s</dd></div>
            <div><dt>Lifecycle mutation</dt><dd>DISABLED</dd></div>
          </dl>
        </section>

        <section>
          <span>Observability</span>
          <h4>Discovery health</h4>
          <dl>
            <div><dt>Enabled</dt><dd>{data.observability.enabled ? "YES" : "NO"}</dd></div>
            <div><dt>Consecutive failures</dt><dd>{data.observability.consecutiveFailures}</dd></div>
            <div><dt>Last error</dt><dd>{data.observability.lastError ?? "NONE"}</dd></div>
          </dl>
        </section>
      </div>

      <div className="post-remediation-stability-blockers">
        <span>Blockers</span>
        <div>{data.blockers.map((item) => <b key={item}>{item}</b>)}</div>
      </div>

      {data.observability.warnings.length ? (
        <div className="post-remediation-stability-warnings">
          <span>Observability warnings</span>
          <div>{data.observability.warnings.map((item) => <b key={item}>{item}</b>)}</div>
        </div>
      ) : null}
    </section>
  );
}
