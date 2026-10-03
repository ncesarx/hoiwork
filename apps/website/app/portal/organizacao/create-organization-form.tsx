"use client";

import { useRef, useState, type FormEvent } from "react";
import styles from "./page.module.css";

export function CreateOrganizationForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pendingRequest = useRef<{ id: string; name: string } | null>(null);
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get("name") ?? "").trim();
    if (!pendingRequest.current || pendingRequest.current.name !== name) {
      pendingRequest.current = { id: crypto.randomUUID(), name };
    }
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/organization", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, requestId: pendingRequest.current.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Não foi possível cadastrar a empresa.");
      window.location.assign("/portal/organizacao");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na conexão. Confira a lista de organizações antes de tentar novamente.");
      setBusy(false);
      submitting.current = false;
    }
  }

  return <form className={styles.invitationForm} onSubmit={submit}>
    <label>Nome da nova empresa<input name="name" required maxLength={120} autoComplete="organization" disabled={busy} /></label>
    <button type="submit" disabled={busy}>{busy ? "Cadastrando..." : "Cadastrar e abrir empresa"}</button>
    {message ? <p role="alert">{message}</p> : null}
  </form>;
}
