"use client";

import { signOut } from "next-auth/react";
import { useState, type FormEvent } from "react";
import styles from "./page.module.css";

export function RevokeSessionsForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    try {
      const response = await fetch("/api/account/sessions/revoke", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: fields.get("currentPassword") }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? `HTTP ${response.status}`);
      form.reset();
      try {
        await signOut({ callbackUrl: "/login" });
      } finally {
        // The server has already invalidated every session if sign-out cannot reach Auth.js.
        window.location.replace("/login");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao encerrar sessões.");
      setBusy(false);
    }
  }

  return <form className={styles.form} onSubmit={submit}>
    <label>Senha atual<input name="currentPassword" type="password" minLength={8} maxLength={128} autoComplete="current-password" required /></label>
    {error ? <p role="alert">{error}</p> : null}
    <button type="submit" disabled={busy}>{busy ? "Encerrando..." : "Encerrar todas as sessões"}</button>
  </form>;
}
