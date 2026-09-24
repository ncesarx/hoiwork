"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AutonomousGovernanceRunButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/observability/autonomous-governance/automation/manual-run",
        { method: "POST", credentials: "include", cache: "no-store" },
      );
      const body = await response.json();
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Falha na execução manual.");
      }

      const result = body.result;
      setMessage(
        result.skipped
          ? `Execução ignorada: ${result.reason}.`
          : `DRY_RUN concluído: ${result.capabilities} capabilities, ${result.blocked} bloqueadas.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha inesperada.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="autonomous-governance-action">
      <button type="button" onClick={run} disabled={busy}>
        {busy ? "Executando…" : "Executar DRY_RUN"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
