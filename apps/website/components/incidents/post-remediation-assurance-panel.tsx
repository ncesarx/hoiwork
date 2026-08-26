export function PostRemediationAssurancePanel({
  data,
}: {
  data: {
    version: string;
    assuranceState: string;
    confidenceScore: number;
    recoveryObserved: boolean;
    recoveryVerified: boolean;
    closureEligible: boolean;
    closureBlockers: string[];
    warnings: string[];
    execution: null | {
      mode: string;
      status: string;
      executor: string;
      mutationPerformed: boolean;
    };
    verification: null | {
      status: string;
      verificationState: string;
      expectedState: string | null;
      observedState: string | null;
    };
    asset: null | {
      status: string;
      active: boolean;
      nodeName: string | null;
      freshnessMinutes: number | null;
    };
    checks: Array<{
      key: string;
      pass: boolean;
      detail: string;
    }>;
  };
}) {
  return (
    <section className="post-remediation-assurance-panel">
      <div className="post-remediation-assurance-heading">
        <div>
          <span>Sprint {data.version}</span>
          <h3>Post-Remediation Evidence Engine</h3>
          <p>
            Correlaciona execução real, autorização, Discovery e Verification.
            Esta etapa é somente evidencial e nunca fecha incidentes.
          </p>
        </div>

        <div className={`assurance-state is-${data.assuranceState.toLowerCase()}`}>
          <span>Assurance State</span>
          <strong>{data.assuranceState}</strong>
        </div>
      </div>

      <div className="post-remediation-assurance-kpis">
        <article>
          <span>Confidence</span>
          <strong>{data.confidenceScore}%</strong>
        </article>
        <article>
          <span>Recovery observed</span>
          <strong>{data.recoveryObserved ? "YES" : "NO"}</strong>
        </article>
        <article>
          <span>Recovery verified</span>
          <strong>{data.recoveryVerified ? "YES" : "NO"}</strong>
        </article>
        <article>
          <span>Closure</span>
          <strong>{data.closureEligible ? "ELIGIBLE" : "BLOCKED"}</strong>
        </article>
      </div>

      <div className="post-remediation-assurance-grid">
        <section>
          <span>Execution Evidence</span>
          <h4>Execução real</h4>
          <dl>
            <div><dt>Mode</dt><dd>{data.execution?.mode ?? "NONE"}</dd></div>
            <div><dt>Status</dt><dd>{data.execution?.status ?? "NONE"}</dd></div>
            <div><dt>Executor</dt><dd>{data.execution?.executor ?? "NONE"}</dd></div>
            <div><dt>Mutation</dt><dd>{data.execution?.mutationPerformed ? "CONFIRMED" : "NO"}</dd></div>
          </dl>
        </section>

        <section>
          <span>Discovery Evidence</span>
          <h4>Estado observado</h4>
          <dl>
            <div><dt>Status</dt><dd>{data.asset?.status ?? "NO_DATA"}</dd></div>
            <div><dt>Active</dt><dd>{data.asset?.active ? "YES" : "NO"}</dd></div>
            <div><dt>Node</dt><dd>{data.asset?.nodeName ?? "N/D"}</dd></div>
            <div><dt>Freshness</dt><dd>{data.asset?.freshnessMinutes ?? "N/D"} min</dd></div>
          </dl>
        </section>

        <section>
          <span>Verification Evidence</span>
          <h4>Verificação</h4>
          <dl>
            <div><dt>Status</dt><dd>{data.verification?.status ?? "MISSING"}</dd></div>
            <div><dt>State</dt><dd>{data.verification?.verificationState ?? "MISSING"}</dd></div>
            <div><dt>Expected</dt><dd>{data.verification?.expectedState ?? "N/D"}</dd></div>
            <div><dt>Observed</dt><dd>{data.verification?.observedState ?? "N/D"}</dd></div>
          </dl>
        </section>
      </div>

      <div className="post-remediation-assurance-checks">
        {data.checks.map((check) => (
          <article key={check.key} className={check.pass ? "is-pass" : "is-fail"}>
            <strong>{check.pass ? "PASS" : "FAIL"}</strong>
            <span>{check.key}</span>
            <small>{check.detail}</small>
          </article>
        ))}
      </div>

      <div className="post-remediation-assurance-blockers">
        <span>Closure blockers</span>
        <div>
          {data.closureBlockers.map((blocker) => <b key={blocker}>{blocker}</b>)}
        </div>
      </div>

      {data.warnings.length ? (
        <div className="post-remediation-assurance-warnings">
          <span>Warnings</span>
          <div>{data.warnings.map((warning) => <b key={warning}>{warning}</b>)}</div>
        </div>
      ) : null}
    </section>
  );
}
