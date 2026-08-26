"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function IncidentReconciliationConsole() {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function run(commit: boolean) {
    setBusy(commit ? "commit" : "dry");
    setMessage("");

    try {
      if (
        commit &&
        !window.confirm(
          "Aplicar reconciliação e permitir RESOLVED automático quando houver duas evidências consecutivas de recuperação?",
        )
      ) {
        setBusy("");
        return;
      }

      const response = await fetch(
        "/api/incidents/reconciliation/manual-run",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commit }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      setMessage(data.message ?? "Reconciliação concluída.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Erro inesperado.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="incident-reconciliation-console">
      <div className="incident-reconciliation-actions">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run(false)}
        >
          {busy === "dry" ? "Analisando..." : "Executar DRY RUN"}
        </button>

        <button
          type="button"
          disabled={!!busy}
          onClick={() => run(true)}
        >
          {busy === "commit"
            ? "Aplicando..."
            : "Aplicar reconciliação"}
        </button>
      </div>

      {message ? <small>{message}</small> : null}
    </section>
  );
}
