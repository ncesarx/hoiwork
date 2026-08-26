"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SloSnapshotCaptureButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function capture() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/observability/snapshots/capture", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);

      setMessage("Snapshot capturado.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="slo-snapshot-action">
      <button type="button" onClick={capture} disabled={busy}>
        {busy ? "Capturando..." : "Capturar snapshot agora"}
      </button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}
