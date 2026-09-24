"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AutonomousGovernanceConfigForm({
  enabled,
  intervalMinutes,
}: {
  enabled: boolean;
  intervalMinutes: number;
}) {
  const router = useRouter();
  const [active, setActive] = useState(enabled);
  const [interval, setInterval] = useState(String(intervalMinutes));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    const minutes = Number(interval);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) {
      setMessage("Informe um intervalo inteiro entre 5 e 1440 minutos.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        "/api/observability/autonomous-governance/automation/config",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: active, intervalMinutes: minutes }),
        },
      );
      const body = await response.json();
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Não foi possível salvar.");
      }
      setMessage(body.changed ? "Configuração salva e auditada." : "Configuração já estava atualizada.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha inesperada.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="autonomous-governance-config">
      <h3>Controle do scheduler</h3>
      <p>O modo COMMIT automático permanece indisponível.</p>
      <div className="autonomous-governance-config-fields">
        <label>
          <span>Scheduler</span>
          <select value={active ? "enabled" : "disabled"} onChange={(event) => setActive(event.target.value === "enabled")}>
            <option value="disabled">Inativo</option>
            <option value="enabled">Ativo</option>
          </select>
        </label>
        <label>
          <span>Intervalo (minutos)</span>
          <input type="number" min="5" max="1440" step="1" value={interval} onChange={(event) => setInterval(event.target.value)} />
        </label>
        <button type="button" onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar configuração"}</button>
      </div>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
