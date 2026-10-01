"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MembershipRole } from "@prisma/client";
import styles from "./page.module.css";

const roles: MembershipRole[] = ["CLIENT", "MANAGER", "TECHNICIAN", "ADMIN"];

export function MemberRoleEditor({
  membershipId,
  currentRole,
  self,
}: {
  membershipId: string;
  currentRole: MembershipRole;
  self: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (self || role === currentRole || busy) return;
    if (!window.confirm(`Alterar o papel deste usuário de ${currentRole} para ${role}?`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/organization/members/${membershipId}/role`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRole: currentRole, role }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? `HTTP ${response.status}`);
      setMessage("Papel atualizado.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar papel.");
    } finally {
      setBusy(false);
    }
  }

  if (self) return <span className={styles.self}>Seu acesso</span>;

  return (
    <div className={styles.editor}>
      <select aria-label="Novo papel" value={role} onChange={(event) => setRole(event.target.value as MembershipRole)} disabled={busy}>
        {roles.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
      <button type="button" onClick={save} disabled={busy || role === currentRole}>{busy ? "Salvando..." : "Salvar"}</button>
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
