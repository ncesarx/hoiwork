"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Result = {
  ok?: boolean;
  error?: string;
  message?: string;
  nodes?: number;
  createdCount?: number;
  updatedCount?: number;
  unchangedCount?: number;
  durationMs?: number;
  clusterName?: string;
  version?: string;
};

export function DiscoveryActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function discover() {
    setBusy(true);
    setResult(null);

    try {
      const response = await fetch(
        "/api/integrations/proxmox/discover-nodes",
        {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
        },
      );

      const text = await response.text();
      let data: Result = {};

      try {
        data = text ? (JSON.parse(text) as Result) : {};
      } catch {
        data = { error: text || `HTTP ${response.status}` };
      }

      if (!response.ok) {
        throw new Error(data.error || `Falha HTTP ${response.status}.`);
      }

      setResult(data);
      router.refresh();
    } catch (error) {
      setResult({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado durante o Discovery.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="discovery-actions">
      <button type="button" onClick={discover} disabled={busy}>
        {busy ? "Descobrindo infraestrutura..." : "Descobrir Nodes Reais"}
      </button>

      {result ? (
        <div className={result.ok === false ? "is-error" : "is-success"}>
          {result.ok === false ? (
            <strong>{result.error}</strong>
          ) : (
            <>
              <strong>{result.message}</strong>
              <small>
                Cluster: {result.clusterName} • Versão: {result.version} •{" "}
                {result.durationMs ?? 0} ms
              </small>
              <small>
                Novos: {result.createdCount ?? 0} • Alterados:{" "}
                {result.updatedCount ?? 0} • Sem mudanças:{" "}
                {result.unchangedCount ?? 0}
              </small>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
