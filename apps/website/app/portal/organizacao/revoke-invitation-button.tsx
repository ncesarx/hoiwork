"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RevokeInvitationButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function revoke() {
    if (busy || !window.confirm("Revogar este convite? O link deixará de funcionar.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/organization/invitations/${encodeURIComponent(id)}`, {
        method: "DELETE", credentials: "include",
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? `HTTP ${response.status}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao revogar convite.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" onClick={revoke} disabled={busy}>{busy ? "Revogando..." : "Revogar"}</button>
    {error ? <small role="alert">{error}</small> : null}
  </>;
}
