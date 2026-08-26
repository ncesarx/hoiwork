"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function IncidentRecurrencePanel() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/incidents/recurrence/run", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      setMessage(
        `${data.message} Inspected=${data.inspected}, candidates=${data.candidates}, created=${data.created}.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha na detecção.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="incident-recurrence-panel">
      <div>
        <span>Sprint 015.6.11.6.3.1</span>
        <h1>Incident Recurrence & Regression Detection</h1>
        <p>
          Detecta ativos que permaneceram ou voltaram a uma condição problemática
          após a resolução de um incidente e abre um novo ciclo operacional.
        </p>
      </div>

      <button disabled={busy} onClick={run}>
        {busy ? "Executando..." : "Executar detector de recorrência"}
      </button>

      {message ? <small>{message}</small> : null}
    </section>
  );
}
