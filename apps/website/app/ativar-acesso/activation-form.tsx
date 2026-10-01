"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

export function ActivationForm() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      setToken(fragment.get("token") ?? "");
      if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || busy) return;
    setBusy(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/organization/invitations/accept", {
        method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email: fields.get("email"), password: fields.get("password") }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? `HTTP ${response.status}`);
      setToken("");
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao ativar acesso.");
    } finally {
      setBusy(false);
    }
  }

  if (success) return <p className="auth-notice" role="status">Acesso ativado. <Link href="/login">Entrar no portal</Link></p>;
  if (!token) return <p className="auth-notice">Abra o link completo enviado pelo administrador para ativar seu acesso.</p>;
  return (
    <form className="auth-form" onSubmit={submit}>
      <label><span>E-mail convidado</span><input name="email" type="email" required autoComplete="email" /></label>
      <label><span>Senha atual se você já tem conta; nova senha (mínimo de 12 caracteres) se ainda não tem</span><input name="password" type="password" required minLength={8} maxLength={128} autoComplete="off" /></label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={busy}>{busy ? "Ativando..." : "Ativar acesso"}</button>
    </form>
  );
}
