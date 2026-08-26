"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegistryConsolidationActions({
  legacyAvailable,
}: {
  legacyAvailable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"legacy" | "all" | null>(null);
  const [message, setMessage] = useState("");

  async function run(kind: "legacy" | "all") {
    setBusy(kind);
    setMessage("");

    try {
      const endpoint =
        kind === "legacy"
          ? "/api/integrations/proxmox/registry/import-legacy"
          : "/api/integrations/proxmox/registry/sync-all";

      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok && response.status !== 207) {
        throw new Error(data.error ?? data.message ?? `HTTP ${response.status}`);
      }

      setMessage(data.message ?? "Operação concluída.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="registry-consolidation-actions">
      <button
        type="button"
        onClick={() => run("legacy")}
        disabled={!legacyAvailable || busy !== null}
      >
        {busy === "legacy" ? "Migrando principal..." : "Migrar Proxmox principal"}
      </button>

      <button
        type="button"
        onClick={() => run("all")}
        disabled={busy !== null}
      >
        {busy === "all" ? "Sincronizando sites..." : "Sincronizar todos"}
      </button>

      {message ? <small>{message}</small> : null}
    </div>
  );
}
