"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RemediationRealExecutorPanel({
  incidentId,
  planId,
  action,
  authorizationId,
  authorizationStatus,
  expiresAt,
  assetName,
  nodeName,
  enabled,
}: {
  incidentId: string;
  planId: string;
  action: string;
  authorizationId: string | null;
  authorizationStatus: string | null;
  expiresAt: string | null;
  assetName: string | null;
  nodeName: string | null;
  enabled: boolean;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const active =
    authorizationStatus === "AUTHORIZED" &&
    Boolean(expiresAt) &&
    new Date(expiresAt as string).getTime() > Date.now();

  async function executeReal() {
    if (!authorizationId) return;

    if (
      !window.confirm(
        `CONFIRMA execução REAL de START_VM para ${assetName ?? "VM"} no node ${nodeName ?? "N/D"}?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/incidents/infrastructure/${incidentId}/remediation-plans/${planId}/execute-real`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authorizationId,
            confirmation,
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      setMessage(data.message ?? "Execução real concluída.");
      setConfirmation("");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Falha na execução real.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="remediation-real-executor-panel">
      <div className="remediation-real-executor-heading">
        <div>
          <span>Sprint 015.6.11.6.3</span>
          <h3>Controlled Execution Runtime</h3>
          <p>
            Consumo atômico de autorização e primeiro executor real START_VM.
            Ação de uso único, com confirmação humana e verificação obrigatória.
          </p>
        </div>

        <div className={`real-executor-state is-${enabled ? "enabled" : "disabled"}`}>
          <span>Real Executor</span>
          <strong>{enabled ? "ENABLED" : "DISABLED"}</strong>
        </div>
      </div>

      <div className="remediation-real-executor-kpis">
        <article><span>Action</span><strong>{action}</strong></article>
        <article><span>Authorization</span><strong>{authorizationStatus ?? "NONE"}</strong></article>
        <article><span>Target</span><strong>{assetName ?? "N/D"}</strong></article>
        <article><span>Node</span><strong>{nodeName ?? "N/D"}</strong></article>
      </div>

      <div className="real-executor-warning">
        Esta ação modifica infraestrutura real. Após execução, rode Discovery e
        Verification imediatamente.
      </div>

      <div className="real-executor-action">
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder='Digite exatamente START_VM'
          disabled={!enabled || !active || busy}
        />
        <button
          disabled={
            !enabled ||
            !active ||
            busy ||
            confirmation !== "START_VM"
          }
          onClick={executeReal}
        >
          {busy ? "Executando..." : "Executar START_VM REAL"}
        </button>
      </div>

      {!active ? (
        <small className="real-executor-blocked">
          Autorização inexistente, expirada, consumida ou revogada.
        </small>
      ) : null}

      {message ? (
        <small className="real-executor-message">{message}</small>
      ) : null}
    </section>
  );
}
