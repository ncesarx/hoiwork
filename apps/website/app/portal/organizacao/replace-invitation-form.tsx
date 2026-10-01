"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./page.module.css";

type PendingInvitation = { id: string; name: string; email: string; role: "CLIENT" | "MANAGER" | "TECHNICIAN" };

export function ReplaceInvitationForm({ invitations }: { invitations: PendingInvitation[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const selected = invitations.find((invitation) => invitation.id === selectedId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    setLink("");
    try {
      const response = await fetch(`/api/organization/invitations/${encodeURIComponent(selected.id)}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fields.get("name"), email: fields.get("email"), role: fields.get("role") }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? `HTTP ${response.status}`);
      const url = new URL("/ativar-acesso", window.location.origin);
      setLink(`${url.toString()}#token=${encodeURIComponent(result.token)}`);
      setMessage("Convite substituído. O link antigo foi invalidado. Copie o novo link agora.");
      setSelectedId("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao substituir convite.");
    } finally {
      setBusy(false);
    }
  }

  if (!invitations.length && !link) return null;
  return <form className={styles.invitationForm} onSubmit={submit}>
    <label>Convite pendente<select aria-label="Convite a substituir" value={selectedId} onChange={(event) => {
      setSelectedId(event.target.value); setLink(""); setMessage("");
    }} disabled={busy}>
      <option value="">Selecione um convite</option>
      {invitations.map((invitation) => <option key={invitation.id} value={invitation.id}>{invitation.email}</option>)}
    </select></label>
    {selected ? <div className={styles.replacementFields} key={selected.id}>
      <label>Nome<input name="name" defaultValue={selected.name} required maxLength={120} /></label>
      <label>E-mail<input name="email" type="email" defaultValue={selected.email} required maxLength={254} /></label>
      <label>Papel<select name="role" defaultValue={selected.role}>
        <option value="CLIENT">CLIENT</option><option value="MANAGER">MANAGER</option><option value="TECHNICIAN">TECHNICIAN</option>
      </select></label>
      <button type="submit" disabled={busy}>{busy ? "Substituindo..." : "Gerar novo link"}</button>
    </div> : null}
    {message ? <p role="status">{message}</p> : null}
    {link ? <div className={styles.invitationLink}>
      <label>Novo link de ativação<input aria-label="Novo link de ativação" readOnly value={link} onFocus={(event) => event.currentTarget.select()} /></label>
      <button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(link); setMessage("Link copiado. Envie-o ao destinatário por um canal seguro."); }
        catch { setMessage("Selecione e copie o link manualmente."); }
      }}>Copiar link</button>
    </div> : null}
  </form>;
}
