"use client";

import { useState, type FormEvent } from "react";
import styles from "./page.module.css";

export function InvitationForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    setLink("");
    try {
      const form = event.currentTarget;
      const fields = new FormData(form);
      const response = await fetch("/api/organization/invitations", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fields.get("name"), email: fields.get("email"), role: fields.get("role") }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? `HTTP ${response.status}`);
      const url = new URL("/ativar-acesso", window.location.origin);
      setLink(`${url.toString()}#token=${encodeURIComponent(result.token)}`);
      setMessage("Convite criado. Copie o link agora; ele não será exibido novamente.");
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar convite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.invitationForm} onSubmit={submit}>
      <label>Nome<input name="name" required maxLength={120} autoComplete="off" /></label>
      <label>E-mail<input name="email" type="email" required maxLength={254} autoComplete="off" /></label>
      <label>Papel<select name="role" defaultValue="CLIENT">
        <option value="CLIENT">CLIENT</option><option value="MANAGER">MANAGER</option><option value="TECHNICIAN">TECHNICIAN</option>
      </select></label>
      <button type="submit" disabled={busy}>{busy ? "Criando..." : "Criar convite"}</button>
      {message ? <p role="status">{message}</p> : null}
      {link ? <div className={styles.invitationLink}>
        <label>Link de ativação<input aria-label="Link de ativação" readOnly value={link} onFocus={(event) => event.currentTarget.select()} /></label>
        <button type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(link); setMessage("Link copiado."); }
          catch { setMessage("Selecione e copie o link manualmente."); }
        }}>Copiar link</button>
      </div> : null}
    </form>
  );
}
