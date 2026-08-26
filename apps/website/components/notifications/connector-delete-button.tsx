"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ConnectorDeleteButton({
  id,
  name,
  mode,
}: {
  id: string;
  name: string;
  mode: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (mode === "LIVE") {
      window.alert("Volte o conector para SIMULATED antes de excluí-lo.");
      return;
    }

    if (!window.confirm(`Excluir o conector "${name}"?`)) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(`/api/notifications/connectors/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Falha ao excluir conector.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="connector-delete-button"
      onClick={remove}
      disabled={busy || mode === "LIVE"}
      title={
        mode === "LIVE"
          ? "Volte para SIMULATED antes de excluir."
          : "Excluir conector"
      }
    >
      {busy ? "Excluindo..." : "Excluir"}
    </button>
  );
}
