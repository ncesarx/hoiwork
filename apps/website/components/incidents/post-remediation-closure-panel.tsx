"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PostRemediationClosurePanel({
  incidentId,
  data,
  canClose,
}: {
  incidentId: string;
  canClose: boolean;
  data: {
    version: string;
    decision: string;
    eligibleForClosure: boolean;
    blockers: string[];
    warnings: string[];
    policy: {
      enabled: boolean;
      minimumConfidence: number;
      requireHealthyDiscovery: boolean;
      maxDiscoveryConsecutiveFailures: number;
      failClosed: boolean;
    };
    stability: {
      stabilityState: string;
      confidenceScore: number;
      evidenceCount: number;
      stableForSeconds: number;
      observability: {
        consecutiveFailures: number;
        lastError: string | null;
      };
    };
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function closeIncident() {
    if (
      !window.confirm(
        "Confirmar fechamento governado do incidente com base nas evidências pós-remediação?",
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/incidents/infrastructure/${incidentId}/post-remediation-closure`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }

      setMessage(payload.message ?? "Incidente fechado.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha no fechamento.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="post-remediation-closure-panel">
      <div className="post-remediation-closure-heading">
        <div>
          <span>Sprint {data.version}</span>
          <h3>Governed Autonomous Closure</h3>
          <p>
            Fecha o incidente somente quando Evidence + Verification + Stability
            + Observability satisfazem integralmente a política fail-closed.
          </p>
        </div>

        <div className={`closure-decision is-${data.eligibleForClosure ? "eligible" : "blocked"}`}>
          <span>Decision</span>
          <strong>{data.decision}</strong>
        </div>
      </div>

      <div className="post-remediation-closure-kpis">
        <article><span>Confidence</span><strong>{data.stability.confidenceScore}%</strong></article>
        <article><span>Stability</span><strong>{data.stability.stabilityState}</strong></article>
        <article><span>Evidence</span><strong>{data.stability.evidenceCount}</strong></article>
        <article><span>Discovery failures</span><strong>{data.stability.observability.consecutiveFailures}</strong></article>
      </div>

      <div className="post-remediation-closure-policy">
        <section>
          <span>Policy</span>
          <dl>
            <div><dt>Enabled</dt><dd>{data.policy.enabled ? "YES" : "NO"}</dd></div>
            <div><dt>Min confidence</dt><dd>{data.policy.minimumConfidence}%</dd></div>
            <div><dt>Healthy Discovery required</dt><dd>{data.policy.requireHealthyDiscovery ? "YES" : "NO"}</dd></div>
            <div><dt>Max consecutive failures</dt><dd>{data.policy.maxDiscoveryConsecutiveFailures}</dd></div>
            <div><dt>Fail closed</dt><dd>{data.policy.failClosed ? "YES" : "NO"}</dd></div>
          </dl>
        </section>
      </div>

      <div className="post-remediation-closure-blockers">
        <span>Blockers</span>
        <div>
          {data.blockers.length
            ? data.blockers.map((item) => <b key={item}>{item}</b>)
            : <b className="is-clear">NONE</b>}
        </div>
      </div>

      {data.warnings.length ? (
        <div className="post-remediation-closure-warnings">
          <span>Warnings</span>
          <div>{data.warnings.map((item) => <b key={item}>{item}</b>)}</div>
        </div>
      ) : null}

      <button
        disabled={!canClose || !data.eligibleForClosure || busy}
        onClick={closeIncident}
      >
        {busy ? "Fechando..." : "Fechar incidente por Post-Remediation Assurance"}
      </button>

      {message ? <small>{message}</small> : null}
    </section>
  );
}
