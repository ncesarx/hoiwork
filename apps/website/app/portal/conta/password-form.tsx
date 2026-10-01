"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import styles from "./page.module.css";

export function PasswordForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const newPassword = String(fields.get("newPassword") ?? "");
    if (newPassword !== fields.get("confirmPassword")) {
      setError("A confirmação não corresponde à nova senha.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account/password", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: fields.get("currentPassword"), newPassword }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? `HTTP ${response.status}`);
      form.reset();
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao alterar senha.");
    } finally {
      setBusy(false);
    }
  }

  if (success) return <p role="status">Senha alterada. <Link href="/login">Entre novamente</Link> com a nova senha.</p>;
  return <form className={styles.form} onSubmit={submit}>
    <label>Senha atual<input name="currentPassword" type="password" minLength={8} maxLength={128} autoComplete="current-password" required /></label>
    <label>Nova senha<input name="newPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
    <label>Confirmar nova senha<input name="confirmPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
    {error ? <p role="alert">{error}</p> : null}
    <button type="submit" disabled={busy}>{busy ? "Salvando..." : "Alterar senha"}</button>
  </form>;
}
