"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function IncidentSlaConsole() {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function run(commit: boolean) {
    setBusy(commit ? "commit" : "dry");
    setMessage("");

    try {
      if (commit && !window.confirm("Aplicar escalonamentos de SLA e enfileirar notificações PENDING?")) {
        setBusy("");
        return;
      }

      const response = await fetch("/api/incidents/sla/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commit }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      setMessage(data.message ?? "SLA Engine concluído.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="incident-sla-console">
      <div>
        <button disabled={!!busy} onClick={() => run(false)}>
          {busy === "dry" ? "Analisando..." : "Executar DRY RUN"}
        </button>
        <button disabled={!!busy} onClick={() => run(true)}>
          {busy === "commit" ? "Aplicando..." : "Aplicar escalonamentos"}
        </button>
      </div>
      {message ? <small>{message}</small> : null}
    </section>
  );
}
