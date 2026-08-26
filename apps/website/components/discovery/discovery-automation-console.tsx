"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DiscoveryAutomationConsole({
  enabled,
  intervalMinutes,
  reconciliationEnabled,
}: {
  enabled: boolean;
  intervalMinutes: number;
  reconciliationEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    enabled,
    intervalMinutes: String(intervalMinutes),
    reconciliationEnabled,
  });

  async function save() {
    setBusy("save");
    setMessage("");

    try {
      const response = await fetch("/api/discovery/automation/config", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: form.enabled,
          intervalMinutes: Number(form.intervalMinutes),
          reconciliationEnabled: form.reconciliationEnabled,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);

      setMessage(
        `Discovery ${data.config.enabled ? "ENABLED" : "DISABLED"} · ` +
        `Lifecycle ${data.config.reconciliationEnabled ? "ENABLED" : "DISABLED"} · ` +
        `${data.config.intervalMinutes} min.`,
      );

      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setBusy("");
    }
  }

  async function run() {
    setBusy("run");
    setMessage("");

    try {
      const response = await fetch("/api/discovery/automation/manual-run", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);

      setMessage(data.message ?? "Discovery manual concluído.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="discovery-automation-console">
      <div className="discovery-automation-form">
        <label>
          <span>Discovery Automation</span>
          <select
            value={form.enabled ? "ENABLED" : "DISABLED"}
            onChange={(e) =>
              setForm({ ...form, enabled: e.target.value === "ENABLED" })
            }
          >
            <option value="DISABLED">DISABLED</option>
            <option value="ENABLED">ENABLED</option>
          </select>
        </label>

        <label>
          <span>Intervalo (min)</span>
          <input
            type="number"
            min="1"
            max="1440"
            value={form.intervalMinutes}
            onChange={(e) =>
              setForm({ ...form, intervalMinutes: e.target.value })
            }
          />
        </label>

        <label>
          <span>Incident Lifecycle</span>
          <select
            value={form.reconciliationEnabled ? "ENABLED" : "DISABLED"}
            onChange={(e) =>
              setForm({
                ...form,
                reconciliationEnabled: e.target.value === "ENABLED",
              })
            }
          >
            <option value="DISABLED">DISABLED</option>
            <option value="ENABLED">ENABLED</option>
          </select>
        </label>
      </div>

      <div className="discovery-automation-actions">
        <button type="button" disabled={!!busy} onClick={save}>
          {busy === "save" ? "Salvando..." : "Salvar configuração"}
        </button>

        <button type="button" disabled={!!busy} onClick={run}>
          {busy === "run" ? "Executando..." : "Executar ciclo manual"}
        </button>
      </div>

      {message ? <small>{message}</small> : null}
    </section>
  );
}
