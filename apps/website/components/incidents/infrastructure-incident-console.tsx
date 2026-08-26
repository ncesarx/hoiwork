"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InfrastructureIncidentConsole() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function correlate() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/incidents/infrastructure/correlate", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      setMessage(data.message ?? "Correlação concluída.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="incident-console">
      <button type="button" onClick={correlate} disabled={busy}>
        {busy ? "Correlacionando..." : "Correlacionar infraestrutura agora"}
      </button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}
