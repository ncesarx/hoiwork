"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Evaluation = {
  id: string;
  decision: string;
  policyVersion: string;
  eligibleForRealExecution: boolean;
  realExecutionStillBlocked: boolean;
  blockers: unknown;
  warnings: unknown;
  evaluatedByName: string | null;
  evaluatedAt: string;
};

export function RemediationGovernancePanel({
  incidentId,
  planId,
  action,
  planStatus,
  evaluations,
}: {
  incidentId: string;
  planId: string;
  action: string;
  planStatus: string;
  evaluations: Evaluation[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function evaluate() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/incidents/infrastructure/${incidentId}/remediation-governance`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      setMessage(data.message ?? "Governança concluída.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Falha na governança.",
      );
    } finally {
      setBusy(false);
    }
  }

  const latest = evaluations[0] ?? null;

  return (
    <section className="remediation-governance-panel">
      <div className="remediation-governance-heading">
        <div>
          <span>Sprint 015.6.11.6.1</span>
          <h3>Execution Policy Engine & Governance Guardrails</h3>
          <p>
            Avaliação fail-closed de policy, aprovação, target, maintenance,
            concorrência, circuit breaker e kill switch.
          </p>
        </div>

        <div className="remediation-governance-decision">
          <span>Decision</span>
          <strong>{latest?.decision ?? "NOT_EVALUATED"}</strong>
        </div>
      </div>

      <div className="remediation-governance-kpis">
        <article>
          <span>Plan</span>
          <strong>{planStatus}</strong>
        </article>
        <article>
          <span>Action</span>
          <strong>{action}</strong>
        </article>
        <article>
          <span>Real eligible</span>
          <strong>
            {latest?.eligibleForRealExecution ? "YES" : "NO"}
          </strong>
        </article>
        <article>
          <span>Execution gate</span>
          <strong>
            {latest?.realExecutionStillBlocked === false
              ? "OPEN"
              : "CLOSED"}
          </strong>
        </article>
      </div>

      <button
        className="remediation-governance-run"
        disabled={busy}
        onClick={evaluate}
      >
        {busy ? "Avaliando..." : "Executar avaliação de governança"}
      </button>

      {message ? (
        <small className="remediation-governance-message">
          {message}
        </small>
      ) : null}

      <div className="remediation-governance-history">
        {evaluations.map((item) => (
          <article key={item.id}>
            <span>{item.policyVersion}</span>
            <strong>{item.decision}</strong>
            <span>
              real eligible{" "}
              {item.eligibleForRealExecution ? "YES" : "NO"}
            </span>
            <span>gate CLOSED</span>
            <span>
              {new Date(item.evaluatedAt).toLocaleString("pt-BR")}
            </span>
            <small>{item.evaluatedByName ?? "Sistema"}</small>
          </article>
        ))}

        {!evaluations.length ? (
          <small>Nenhuma avaliação registrada.</small>
        ) : null}
      </div>
    </section>
  );
}
