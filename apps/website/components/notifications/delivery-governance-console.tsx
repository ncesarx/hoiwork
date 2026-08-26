"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeliveryGovernanceConsole() {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [windowForm, setWindowForm] = useState({
    name: "Janela de Manutenção",
    reason: "",
    startsAt: "",
    endsAt: "",
  });

  async function releaseOne() {
    setBusy("release"); setMessage("");
    try {
      const r = await fetch("/api/notifications/governance/release-held", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 1 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setMessage(d.message);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setBusy("");
    }
  }

  async function governAndDispatch() {
    setBusy("govern"); setMessage("");
    try {
      const r = await fetch("/api/notifications/governance/evaluate", {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setMessage(d.message);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setBusy("");
    }
  }

  async function createWindow() {
    setBusy("window"); setMessage("");
    try {
      const r = await fetch("/api/notifications/governance/maintenance", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(windowForm),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setMessage("Maintenance window criada.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="delivery-governance-console">
      <div className="delivery-governance-actions">
        <button disabled={!!busy} onClick={releaseOne}>
          {busy === "release" ? "Liberando..." : "Liberar 1 HELD_TEST"}
        </button>
        <button disabled={!!busy} onClick={governAndDispatch}>
          {busy === "govern" ? "Processando..." : "Governar + Dispatcher"}
        </button>
      </div>

      <div className="maintenance-window-form">
        <label><span>Nome</span><input value={windowForm.name} onChange={e=>setWindowForm({...windowForm,name:e.target.value})}/></label>
        <label><span>Início</span><input type="datetime-local" value={windowForm.startsAt} onChange={e=>setWindowForm({...windowForm,startsAt:e.target.value})}/></label>
        <label><span>Fim</span><input type="datetime-local" value={windowForm.endsAt} onChange={e=>setWindowForm({...windowForm,endsAt:e.target.value})}/></label>
        <label className="wide"><span>Motivo</span><input value={windowForm.reason} onChange={e=>setWindowForm({...windowForm,reason:e.target.value})}/></label>
        <button disabled={!!busy || !windowForm.startsAt || !windowForm.endsAt} onClick={createWindow}>
          {busy === "window" ? "Criando..." : "Criar maintenance window"}
        </button>
      </div>

      {message ? <small>{message}</small> : null}
    </section>
  );
}
