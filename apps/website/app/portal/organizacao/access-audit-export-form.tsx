"use client";

import { useState, type FormEvent } from "react";
import styles from "./page.module.css";

export function AccessAuditExportForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const from = String(fields.get("from") ?? "");
    const to = String(fields.get("to") ?? "");
    if (Boolean(from) !== Boolean(to)) {
      setError("Preencha as duas datas ou deixe ambas em branco.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const url = new URL("/api/organization/access-audit/export", window.location.origin);
      if (from && to) { url.searchParams.set("from", from); url.searchParams.set("to", to); }
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? `HTTP ${response.status}`);
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `hoiwork-acessos-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao exportar auditoria.");
    } finally {
      setBusy(false);
    }
  }

  return <form className={styles.auditExportForm} onSubmit={submit}>
    <label>De (UTC)<input name="from" type="date" /></label>
    <label>Até (UTC)<input name="to" type="date" /></label>
    <button type="submit" disabled={busy}>{busy ? "Gerando..." : "Exportar CSV"}</button>
    {error ? <small role="alert">{error}</small> : null}
  </form>;
}
