"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { manualAssetTypes } from "@/lib/inventory/manual-asset-schema";
import styles from "./manual-asset-form.module.css";

export function ManualAssetForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const pending = useRef<{ payload: string; id: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    const payload = JSON.stringify(fields);
    if (!pending.current || pending.current.payload !== payload) pending.current = { payload, id: crypto.randomUUID() };
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/inventory/assets", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, requestId: pending.current.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Não foi possível cadastrar.");
      form.reset();
      pending.current = null;
      setMessage("Equipamento cadastrado. Se houver filtros ativos, limpe-os para visualizar o novo item.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na conexão. Confira o inventário antes de tentar novamente.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <section className={`portal-panel ${styles.panel}`} aria-labelledby="manual-asset-title">
    <h2 id="manual-asset-title">Cadastrar equipamento</h2>
    <p>Para recursos cadastrados manualmente. O cadastro não verifica disponibilidade nem executa monitoramento.</p>
    <form onSubmit={submit}>
      <fieldset className={styles.fields} disabled={busy}>
        <label>Nome<input name="name" required maxLength={120} /></label>
        <label>Tipo<select name="type" defaultValue="WORKSTATION">{manualAssetTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label>Fabricante<input name="manufacturer" maxLength={120} /></label>
        <label>Modelo<input name="model" maxLength={120} /></label>
        <label>Número de série<input name="serialNumber" maxLength={120} /></label>
        <label>IP (opcional)<input name="ipAddress" maxLength={45} placeholder="IPv4 ou IPv6" /></label>
        <label>Localização<input name="location" maxLength={200} placeholder="Ex.: Matriz / Recepção" /></label>
        <button type="submit">{busy ? "Cadastrando..." : "Cadastrar equipamento"}</button>
      </fieldset>
      {message ? <p role="status">{message}</p> : null}
    </form>
  </section>;
}
