"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createTicket, type TicketState } from "@/app/portal/chamados/actions";

const initialState: TicketState = { success:false, message:"" };

function SubmitButton(){
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? "Registrando..." : "Abrir chamado"}</button>;
}

export function TicketForm(){
  const [state, action] = useActionState(createTicket, initialState);
  return <form action={action} className="data-ticket-form">
    <label><span>Título</span><input name="title" minLength={5} maxLength={140} required /></label>
    <label><span>Prioridade</span><select name="priority" defaultValue="MEDIUM">
      <option value="LOW">Baixa</option><option value="MEDIUM">Média</option>
      <option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option>
    </select></label>
    <label className="data-ticket-form__description"><span>Descrição</span><textarea name="description" minLength={10} maxLength={5000} required /></label>
    {state.message ? <p className={state.success ? "is-success" : "is-error"}>{state.message}</p> : null}
    <SubmitButton />
  </form>;
}
