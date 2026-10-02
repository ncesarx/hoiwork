"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./page.module.css";

export function OrganizationProfileForm({ name }: { name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/organization/profile", {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fields.get("name") }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Não foi possível salvar.");
      setMessage("Nome da empresa atualizado no portal.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return <form className={styles.invitationForm} onSubmit={submit}>
    <label>Nome da empresa<input key={name} name="name" defaultValue={name} required maxLength={120} autoComplete="organization" disabled={busy} /></label>
    <button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar nome da empresa"}</button>
    {message ? <p role="status">{message}</p> : null}
  </form>;
}
