"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { authenticate } from "@/app/login/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Entrando..." : "Entrar no Portal"}
    </button>
  );
}

export function LoginForm() {
  const [errorMessage, formAction] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="auth-form">
      <label>
        <span>E-mail corporativo</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        <span>Senha</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          required
        />
      </label>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <SubmitButton />
    </form>
  );
}
