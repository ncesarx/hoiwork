"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AlertPolicyConsole() {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "Política High/Critical",
    minSeverity: "HIGH",
    channel: "EMAIL",
    recipients: "",
    escalateAfterMinutes: "30",
    repeatEveryMinutes: "60",
  });

  async function createPolicy() {
    setBusy("create");
    setMessage("");
    try {
      const recipients = form.recipients
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      const response = await fetch("/api/alerts/policies", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: form.name,
          minSeverity: form.minSeverity,
          channels: [form.channel],
          recipients,
          escalateAfterMinutes: Number(form.escalateAfterMinutes),
          repeatEveryMinutes: Number(form.repeatEveryMinutes),
        }),
      });

      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${response.status}`);

      setMessage("Política criada.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setBusy("");
    }
  }

  async function evaluate() {
    setBusy("evaluate");
    setMessage("");
    try {
      const response = await fetch("/api/alerts/evaluate", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${response.status}`);
      setMessage(data.message ?? "Avaliação concluída.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="alert-policy-console">
      <div className="alert-policy-console__form">
        <label><span>Nome</span><input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></label>
        <label><span>Severidade mínima</span><select value={form.minSeverity} onChange={(e)=>setForm({...form,minSeverity:e.target.value})}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
        <label><span>Canal</span><select value={form.channel} onChange={(e)=>setForm({...form,channel:e.target.value})}><option>EMAIL</option><option>WHATSAPP</option><option>SLACK</option><option>WEBHOOK</option></select></label>
        <label className="is-wide"><span>Destinatários</span><input value={form.recipients} onChange={(e)=>setForm({...form,recipients:e.target.value})} placeholder="noc@empresa.com, admin@empresa.com"/></label>
        <label><span>Escalar após (min)</span><input type="number" min="1" value={form.escalateAfterMinutes} onChange={(e)=>setForm({...form,escalateAfterMinutes:e.target.value})}/></label>
        <label><span>Repetir a cada (min)</span><input type="number" min="1" value={form.repeatEveryMinutes} onChange={(e)=>setForm({...form,repeatEveryMinutes:e.target.value})}/></label>
      </div>
      <div className="alert-policy-console__actions">
        <button onClick={createPolicy} disabled={busy !== ""}>{busy==="create"?"Criando...":"Criar política"}</button>
        <button onClick={evaluate} disabled={busy !== ""}>{busy==="evaluate"?"Avaliando...":"Avaliar alertas agora"}</button>
      </div>
      {message ? <small>{message}</small> : null}
    </section>
  );
}
