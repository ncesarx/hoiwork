"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConnectorDeleteButton } from "@/components/notifications/connector-delete-button";

type Connector = {
  id: string;
  name: string;
  type: string;
  mode: string;
  lastTestStatus: string | null;
};

export function NotificationConsole({ connectors }: { connectors: Connector[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "SMTP NOC",
    type: "EMAIL",
    secretRef: "HOIWORK_SMTP_PASSWORD",
    host: "",
    port: "587",
    secure: false,
    user: "",
    from: "",
    tlsServername: "",
    rejectUnauthorized: true,
    url: "",
  });

  async function create() {
    setBusy("create"); setMessage("");
    try {
      const r = await fetch("/api/notifications/connectors", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, port: Number(form.port) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setMessage("Conector criado em SIMULATED. Teste antes de habilitar LIVE.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro inesperado.");
    } finally { setBusy(""); }
  }

  async function test(id: string) {
    setBusy(`test:${id}`); setMessage("");
    try {
      const r = await fetch(`/api/notifications/connectors/${id}/test`, {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setMessage(d.message ?? "Conector validado.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro inesperado.");
    } finally { setBusy(""); }
  }

  async function mode(id: string, nextMode: "LIVE" | "SIMULATED") {
    setBusy(`mode:${id}`); setMessage("");
    try {
      const r = await fetch(`/api/notifications/connectors/${id}/mode`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setMessage(`Modo alterado para ${nextMode}.`);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro inesperado.");
    } finally { setBusy(""); }
  }

  async function dispatch() {
    setBusy("dispatch"); setMessage("");
    try {
      const r = await fetch("/api/notifications/dispatch", {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setMessage(`${d.message} SENT=${d.sent} SIMULATED=${d.simulated} RETRY=${d.retryPending} FAILED=${d.failed}`);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro inesperado.");
    } finally { setBusy(""); }
  }

  return (
    <section className="notification-console">
      <div className="notification-form">
        <label><span>Nome</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label><span>Tipo</span><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>EMAIL</option><option>WEBHOOK</option><option>WHATSAPP</option></select></label>

        {form.type === "EMAIL" ? <>
          <label><span>SMTP host</span><input value={form.host} onChange={e=>setForm({...form,host:e.target.value})} placeholder="smtp.exemplo.com"/></label>
          <label><span>Porta</span><input type="number" value={form.port} onChange={e=>setForm({...form,port:e.target.value})}/></label>
          <label><span>Usuário SMTP</span><input value={form.user} onChange={e=>setForm({...form,user:e.target.value})}/></label>
          <label><span>From</span><input value={form.from} onChange={e=>setForm({...form,from:e.target.value})} placeholder="HOIWORK <noc@empresa.com>"/></label>
          <label><span>Password ENV ref</span><input value={form.secretRef} onChange={e=>setForm({...form,secretRef:e.target.value})}/></label>
          <label><span>TLS servername</span><input value={form.tlsServername} onChange={e=>setForm({...form,tlsServername:e.target.value})} placeholder="smtp.exemplo.com"/></label>
          <label><input type="checkbox" checked={form.secure} onChange={e=>setForm({...form,secure:e.target.checked})}/><span>TLS imediato (465)</span></label>
          <label><input type="checkbox" checked={form.rejectUnauthorized} onChange={e=>setForm({...form,rejectUnauthorized:e.target.checked})}/><span>Validar certificado TLS</span></label>
        </> : null}

        {form.type === "WEBHOOK" ? <>
          <label className="wide"><span>Webhook URL</span><input value={form.url} onChange={e=>setForm({...form,url:e.target.value})}/></label>
          <label className="wide"><span>Bearer token ENV ref</span><input value={form.secretRef} onChange={e=>setForm({...form,secretRef:e.target.value})}/></label>
        </> : null}
      </div>

      <div className="notification-actions">
        <button disabled={!!busy} onClick={create}>{busy==="create"?"Criando...":"Criar conector"}</button>
        <button disabled={!!busy} onClick={dispatch}>{busy==="dispatch"?"Processando...":"Executar dispatcher"}</button>
      </div>

      <div className="notification-health-actions">
        {connectors.map(c => (
          <div key={c.id}>
            <span>{c.name} · {c.type} · {c.mode} · {c.lastTestStatus ?? "NÃO TESTADO"}</span>
            <button disabled={!!busy} onClick={()=>test(c.id)}>{busy===`test:${c.id}`?"Testando...":"Testar"}</button>
            <button disabled={!!busy || c.lastTestStatus!=="HEALTHY"} onClick={()=>mode(c.id,c.mode==="LIVE"?"SIMULATED":"LIVE")}>
            <ConnectorDeleteButton
              id={c.id}
              name={c.name}
              mode={c.mode}
            />
              {c.mode==="LIVE"?"Voltar SIMULATED":"Ativar LIVE"}
            </button>
          </div>
        ))}
      </div>

      {message ? <small>{message}</small> : null}
    </section>
  );
}
