"use client";

import { useId, useRef, useState } from "react";
import styles from "./manual-asset-form.module.css";

type HistoryEvent = {
  id: string; createdAt: string; action: string; actor: string;
  changes: { field: string; previous: string; next: string }[];
};

export function ManualAssetHistory({ assetId, assetName, version }: { assetId: string; assetName: string; version: string }) {
  // Remount the view on edits so a previously opened history cannot show stale records.
  return <HistoryView key={version} assetId={assetId} assetName={assetName} />;
}

function HistoryView({ assetId, assetName }: { assetId: string; assetName: string }) {
  const sectionId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<{ events: HistoryEvent[]; hasMore: boolean } | null>(null);
  const loading = useRef(false);

  async function load() {
    if (loading.current) return;
    loading.current = true;
    setOpen(true); setBusy(true); setError(""); setHistory(null);
    try {
      const response = await fetch(`/api/inventory/assets/${encodeURIComponent(assetId)}/history`, { credentials: "include", cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Não foi possível consultar.");
      setHistory({ events: result.events, hasMore: result.hasMore });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao consultar o histórico.");
    } finally {
      loading.current = false; setBusy(false);
    }
  }

  return <div className={styles.history}>
    <button type="button" disabled={busy} aria-expanded={open} aria-controls={sectionId} aria-label={`Histórico de ${assetName}`} onClick={() => open ? setOpen(false) : void load()}>
      {busy ? "Carregando histórico..." : open ? "Fechar histórico" : "Ver histórico"}
    </button>
    {open ? <div id={sectionId} aria-live="polite">
      {error ? <p role="alert">{error} <button type="button" disabled={busy} onClick={() => void load()}>Tentar novamente</button></p> : null}
      {history ? <>
        <p>Até 20 registros mais recentes. Horários de Brasília.</p>
        {history.events.length ? <ol className={styles.historyEvents}>{history.events.map((event) => <li key={event.id}>
          <strong>{event.action}</strong>
          <p><time dateTime={event.createdAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(event.createdAt))}</time> · {event.actor}</p>
          {event.changes.length ? <ul>{event.changes.map((change) => <li key={change.field}>
            {change.field}: <span>{change.previous}</span> → <span>{change.next}</span>
          </li>)}</ul> : event.action === "Equipamento alterado" ? <p>Detalhes dos campos não disponíveis neste registro.</p> : null}
        </li>)}</ol> : <p>Nenhum registro de cadastro ou edição disponível.</p>}
        {history.hasMore ? <p>Há registros anteriores que não estão incluídos nesta consulta.</p> : null}
      </> : null}
    </div> : null}
  </div>;
}
