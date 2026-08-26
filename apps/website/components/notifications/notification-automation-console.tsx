"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NotificationAutomationConsole({
  enabled,
  intervalMinutes,
}: {
  enabled: boolean;
  intervalMinutes: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    enabled,
    intervalMinutes: String(intervalMinutes),
  });

  async function saveConfig() {
    setBusy("config");
    setMessage("");

    try {
      const response = await fetch("/api/notifications/automation/config", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: form.enabled,
          intervalMinutes: Number(form.intervalMinutes),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);

      setMessage(
        data.config.enabled
          ? `Automação habilitada a cada ${data.config.intervalMinutes} min.`
          : "Automação permanece desabilitada.",
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setBusy("");
    }
  }

  async function manualRun() {
    setBusy("run");
    setMessage("");

    try {
      const response = await fetch(
        "/api/notifications/automation/manual-run",
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);

      setMessage(data.message ?? "Ciclo manual concluído.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="notification-automation-console">
      <div className="notification-automation-config">
        <label>
          <span>Automação</span>
          <select
            value={form.enabled ? "ENABLED" : "DISABLED"}
            onChange={(e) =>
              setForm({
                ...form,
                enabled: e.target.value === "ENABLED",
              })
            }
          >
            <option value="DISABLED">DISABLED</option>
            <option value="ENABLED">ENABLED</option>
          </select>
        </label>

        <label>
          <span>Intervalo lógico (min)</span>
          <input
            type="number"
            min="1"
            max="1440"
            value={form.intervalMinutes}
            onChange={(e) =>
              setForm({
                ...form,
                intervalMinutes: e.target.value,
              })
            }
          />
        </label>
      </div>

      <div className="notification-automation-actions">
        <button type="button" disabled={!!busy} onClick={saveConfig}>
          {busy === "config" ? "Salvando..." : "Salvar configuração"}
        </button>

        <button type="button" disabled={!!busy} onClick={manualRun}>
          {busy === "run" ? "Executando..." : "Executar ciclo manual"}
        </button>
      </div>

      {message ? <small>{message}</small> : null}
    </section>
  );
}
