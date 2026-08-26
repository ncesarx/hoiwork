"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RetentionGovernanceConsole({
  enabled,
  retentionDays,
}: {
  enabled: boolean;
  retentionDays: number;
}) {
  const router = useRouter();
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  const [form,setForm]=useState({
    enabled,
    retentionDays:String(retentionDays),
  });

  async function save() {
    setBusy("save"); setMessage("");
    try {
      const r=await fetch("/api/observability/retention/config",{
        method:"POST",
        credentials:"include",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          enabled:form.enabled,
          retentionDays:Number(form.retentionDays),
        }),
      });
      const d=await r.json();
      if(!r.ok) throw new Error(d.error??`HTTP ${r.status}`);
      setMessage(`Retenção configurada para ${d.config.retentionDays} dias.`);
      router.refresh();
    } catch(e) {
      setMessage(e instanceof Error?e.message:"Erro inesperado.");
    } finally { setBusy(""); }
  }

  async function cleanup() {
    setBusy("cleanup"); setMessage("");
    try {
      const r=await fetch("/api/observability/retention/run",{
        method:"POST",
        credentials:"include",
      });
      const d=await r.json();
      if(!r.ok) throw new Error(d.error??`HTTP ${r.status}`);
      setMessage(
        d.result.skipped
          ? `Cleanup ignorado: ${d.result.reason}.`
          : `Cleanup concluído. ${d.result.deleted} snapshot(s) removido(s).`,
      );
      router.refresh();
    } catch(e) {
      setMessage(e instanceof Error?e.message:"Erro inesperado.");
    } finally { setBusy(""); }
  }

  return (
    <section className="retention-governance-console">
      <div className="retention-form">
        <label>
          <span>Retenção</span>
          <select
            value={form.enabled?"ENABLED":"DISABLED"}
            onChange={e=>setForm({...form,enabled:e.target.value==="ENABLED"})}
          >
            <option value="ENABLED">ENABLED</option>
            <option value="DISABLED">DISABLED</option>
          </select>
        </label>
        <label>
          <span>Dias</span>
          <input
            type="number"
            min="7"
            max="3650"
            value={form.retentionDays}
            onChange={e=>setForm({...form,retentionDays:e.target.value})}
          />
        </label>
      </div>
      <div className="retention-actions">
        <button disabled={!!busy} onClick={save}>
          {busy==="save"?"Salvando...":"Salvar retenção"}
        </button>
        <button disabled={!!busy} onClick={cleanup}>
          {busy==="cleanup"?"Executando...":"Executar cleanup agora"}
        </button>
      </div>
      {message?<small>{message}</small>:null}
    </section>
  );
}
