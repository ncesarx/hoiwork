"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Verification = {
  id: string;
  mode: string;
  status: string;
  verificationState: string;
  rollbackReadiness: string;
  expectedState: string | null;
  observedState: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export function RemediationVerificationPanel({
  incidentId,
  planId,
  action,
  executionCompleted,
  verifications,
}: {
  incidentId: string;
  planId: string;
  action: string;
  executionCompleted: boolean;
  verifications: Verification[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function verify() {
    if (
      !window.confirm(
        `Verificar o plano ${action}? Nenhum rollback será executado.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/incidents/infrastructure/${incidentId}/remediation-plans/${planId}/verify`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      setMessage(data.message ?? "Verificação concluída.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Falha na verificação.",
      );
    } finally {
      setBusy(false);
    }
  }

  const latest = verifications[0] ?? null;

  return (
    <section className="remediation-verification-panel">
      <div className="remediation-verification-heading">
        <div>
          <span>Sprint 015.6.11.5.4</span>
          <h3>Verification & Rollback Readiness</h3>
          <p>
            Confirmação pós-execução e avaliação de rollback. Nenhuma ação de
            rollback é executada nesta versão.
          </p>
        </div>

        <div className="remediation-verification-state">
          <span>Verification State</span>
          <strong>{latest?.verificationState ?? "PENDING"}</strong>
        </div>
      </div>

      <div className="remediation-verification-kpis">
        <article>
          <span>Action</span>
          <strong>{action}</strong>
        </article>
        <article>
          <span>Execution completed</span>
          <strong>{executionCompleted ? "YES" : "NO"}</strong>
        </article>
        <article>
          <span>Rollback readiness</span>
          <strong>{latest?.rollbackReadiness ?? "UNKNOWN"}</strong>
        </article>
        <article>
          <span>Rollback execution</span>
          <strong>BLOCKED</strong>
        </article>
      </div>

      <button
        className="remediation-verification-run"
        disabled={busy || !executionCompleted}
        onClick={verify}
      >
        {busy ? "Verificando..." : "Executar verificação"}
      </button>

      {message ? (
        <small className="remediation-verification-message">
          {message}
        </small>
      ) : null}

      <div className="remediation-verification-history">
        {verifications.map((item) => (
          <article key={item.id}>
            <span>{item.mode}</span>
            <strong>{item.verificationState}</strong>
            <span>{item.rollbackReadiness}</span>
            <span>
              {item.observedState ?? "N/D"} / {item.expectedState ?? "N/D"}
            </span>
            <span>{item.durationMs ?? 0} ms</span>
            <small>{item.errorMessage ?? "sem erro"}</small>
          </article>
        ))}

        {!verifications.length ? (
          <small>Nenhuma verificação registrada.</small>
        ) : null}
      </div>
    </section>
  );
}
