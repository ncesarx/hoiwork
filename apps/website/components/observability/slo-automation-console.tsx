"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SloAutomationConsole({
  initial,
}: {
  initial: {
    enabled: boolean;
    intervalMinutes: number;
    nocDegradedBelow: number;
    nocCriticalBelow: number;
    burnDegradedAt: number;
    burnCriticalAt: number;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    enabled: initial.enabled,
    intervalMinutes: String(initial.intervalMinutes),
    nocDegradedBelow: String(initial.nocDegradedBelow),
    nocCriticalBelow: String(initial.nocCriticalBelow),
    burnDegradedAt: String(initial.burnDegradedAt),
    burnCriticalAt: String(initial.burnCriticalAt),
  });

  async function save() {
    setBusy("save");
    setMessage("");
    try {
      const r = await fetch("/api/observability/slo-automation/config", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: form.enabled,
          intervalMinutes: Number(form.intervalMinutes),
          nocDegradedBelow: Number(form.nocDegradedBelow),
          nocCriticalBelow: Number(form.nocCriticalBelow),
          burnDegradedAt: Number(form.burnDegradedAt),
          burnCriticalAt: Number(form.burnCriticalAt),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setMessage(
        d.config.enabled
          ? `SLO Automation habilitada a cada ${d.config.intervalMinutes} min.`
          : "SLO Automation permanece desabilitada.",
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setBusy("");
    }
  }

  async function run() {
    setBusy("run");
    setMessage("");
    try {
      const r = await fetch("/api/observability/slo-automation/manual-run", {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setMessage(d.message ?? "Ciclo SLO concluído.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="slo-automation-console">
      <div className="slo-automation-form">
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
          <span>Intervalo (min)</span>
          <input
            type="number"
            min="5"
            value={form.intervalMinutes}
            onChange={(e) =>
              setForm({ ...form, intervalMinutes: e.target.value })
            }
          />
        </label>

        <label>
          <span>NOC degradado abaixo de</span>
          <input
            type="number"
            min="1"
            max="100"
            value={form.nocDegradedBelow}
            onChange={(e) =>
              setForm({ ...form, nocDegradedBelow: e.target.value })
            }
          />
        </label>

        <label>
          <span>NOC crítico abaixo de</span>
          <input
            type="number"
            min="0"
            max="99"
            value={form.nocCriticalBelow}
            onChange={(e) =>
              setForm({ ...form, nocCriticalBelow: e.target.value })
            }
          />
        </label>

        <label>
          <span>Burn degradado em</span>
          <input
            type="number"
            step="0.1"
            value={form.burnDegradedAt}
            onChange={(e) =>
              setForm({ ...form, burnDegradedAt: e.target.value })
            }
          />
        </label>

        <label>
          <span>Burn crítico em</span>
          <input
            type="number"
            step="0.1"
            value={form.burnCriticalAt}
            onChange={(e) =>
              setForm({ ...form, burnCriticalAt: e.target.value })
            }
          />
        </label>
      </div>

      <div className="slo-automation-actions">
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
