"use client";

import { useRef, useState } from "react";
import styles from "./manual-asset-form.module.css";

export function ManualAssetExport({ query, type }: { query: string; type: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  async function download() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ q: query, type });
      const response = await fetch(`/api/inventory/assets/export?${params}`, { credentials: "include", cache: "no-store" });
      if (!response.ok || !response.headers.get("Content-Type")?.startsWith("text/csv")) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? "Não foi possível exportar. Confira seu acesso e tente novamente.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = "hoiwork-equipamentos-manuais.csv";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao exportar equipamentos.");
    } finally {
      pending.current = false; setBusy(false);
    }
  }
  return <div className={styles.history}>
    <button type="button" disabled={busy} onClick={() => void download()}>{busy ? "Preparando CSV..." : "Exportar equipamentos manuais (CSV)"}</button>
    <p>Usa os filtros aplicados acima e a empresa selecionada. Até 1000 equipamentos por arquivo; recursos Proxmox não são incluídos.</p>
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
