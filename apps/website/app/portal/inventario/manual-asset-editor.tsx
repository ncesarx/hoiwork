"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { manualAssetTypes } from "@/lib/inventory/manual-asset-schema";
import styles from "./manual-asset-form.module.css";

export function ManualAssetEditor({ asset }: { asset: {
  id: string; name: string; type: string; manufacturer: string | null; model: string | null;
  serialNumber: string | null; ipAddress: string | null; location: string | null; updatedAt: string;
} }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    submitting.current = true;
    setBusy(true);
    setMessage("");
    setConflict(false);
    try {
      const response = await fetch(`/api/inventory/assets/${encodeURIComponent(asset.id)}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, expectedUpdatedAt: asset.updatedAt }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setConflict(response.status === 409);
        throw new Error(result.error ?? "Não foi possível salvar.");
      }
      setMessage("Equipamento atualizado.");
      setEditing(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na conexão. Confira o equipamento antes de tentar novamente.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <div className={styles.editor}>
    {!editing ? <button type="button" onClick={() => { setEditing(true); setMessage(""); }}>Editar equipamento</button> : (
      <form key={asset.updatedAt} onSubmit={submit}>
        <fieldset className={styles.fields} disabled={busy}>
          <label>Nome<input name="name" required maxLength={120} defaultValue={asset.name} /></label>
          <label>Tipo<select name="type" defaultValue={asset.type}>{manualAssetTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
          <label>Fabricante<input name="manufacturer" maxLength={120} defaultValue={asset.manufacturer ?? ""} /></label>
          <label>Modelo<input name="model" maxLength={120} defaultValue={asset.model ?? ""} /></label>
          <label>Número de série<input name="serialNumber" maxLength={120} defaultValue={asset.serialNumber ?? ""} /></label>
          <label>IP (opcional)<input name="ipAddress" maxLength={45} defaultValue={asset.ipAddress ?? ""} /></label>
          <label>Localização<input name="location" maxLength={200} defaultValue={asset.location ?? ""} /></label>
          <button type="submit">{busy ? "Salvando..." : "Salvar alterações"}</button>
          <button type="button" onClick={() => { setEditing(false); setMessage(""); setConflict(false); }}>Cancelar</button>
        </fieldset>
      </form>
    )}
    {message ? <p role="status">{message}</p> : null}
    {conflict ? <button type="button" disabled={busy} onClick={() => {
      setEditing(false); setConflict(false); setMessage("Abra a edição e revise os dados atualizados antes de salvar."); router.refresh();
    }}>Recarregar dados</button> : null}
  </div>;
}
