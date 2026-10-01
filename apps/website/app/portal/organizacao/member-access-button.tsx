"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MemberAccessButton({ membershipId, active, self, userActive }: {
  membershipId: string;
  active: boolean;
  self: boolean;
  userActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (self || busy || !window.confirm(active
      ? "Suspender este acesso? As sessões atuais perderão acesso à organização."
      : "Reativar este acesso à organização?")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/organization/members/${encodeURIComponent(membershipId)}/access`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedActive: active, active: !active }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? `HTTP ${response.status}`);
      router.refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Falha ao alterar acesso.");
    } finally {
      setBusy(false);
    }
  }

  if (self) return <span>Seu acesso</span>;
  if (!userActive && !active) return <span>Conta inativa</span>;
  return <>
    <button type="button" onClick={save} disabled={busy}>{busy ? "Salvando..." : active ? "Suspender" : "Reativar"}</button>
    {message ? <small role="alert">{message}</small> : null}
  </>;
}
