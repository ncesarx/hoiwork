"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Run = {
  id: string;
  mode: string;
  status: string;
  executor: string;
  durationMs: number | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export function RemediationExecutorPanel({
  incidentId,
  planId,
  planStatus,
  action,
  runs,
}: {
  incidentId: string;
  planId: string;
  planStatus: string;
  action: string;
  runs: Run[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function simulate() {
    if (
      !window.confirm(
        `Executar SIMULAÇÃO do plano ${action}? Nenhuma alteração real será feita.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/incidents/infrastructure/${incidentId}/remediation-plans/${planId}/execute-simulated`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      setMessage(data.message ?? "Simulação concluída.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Falha na execução simulada.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="remediation-executor-panel">
      <div className="remediation-executor-heading">
        <div>
          <span>Sprint 015.6.11.5.3</span>
          <h3>Safe Executor Framework</h3>
          <p>
            Executor exclusivamente SIMULATED. Nenhuma chamada mutável ao
            Proxmox é permitida nesta versão.
          </p>
        </div>
        <div>
          <span>Execution Mode</span>
          <strong>SIMULATED ONLY</strong>
        </div>
      </div>

      <div className="remediation-executor-kpis">
        <article><span>Plan</span><strong>{planStatus}</strong></article>
        <article><span>Action</span><strong>{action}</strong></article>
        <article><span>Real mutation</span><strong>BLOCKED</strong></article>
        <article><span>Runs</span><strong>{runs.length}</strong></article>
      </div>

      <button
        className="remediation-executor-run"
        disabled={busy || planStatus !== "APPROVED"}
        onClick={simulate}
      >
        {busy ? "Simulando..." : "Executar SIMULAÇÃO"}
      </button>

      {message ? <small className="remediation-executor-message">{message}</small> : null}

      <div className="remediation-executor-history">
        {runs.map((run) => (
          <article key={run.id}>
            <span>{run.mode}</span>
            <strong>{run.status}</strong>
            <span>{run.executor}</span>
            <span>{run.durationMs ?? 0} ms</span>
            <span>{new Date(run.startedAt).toLocaleString("pt-BR")}</span>
            <small>{run.errorMessage ?? "sem erro"}</small>
          </article>
        ))}

        {!runs.length ? (
          <small>Nenhuma execução simulada registrada.</small>
        ) : null}
      </div>
    </section>
  );
}
