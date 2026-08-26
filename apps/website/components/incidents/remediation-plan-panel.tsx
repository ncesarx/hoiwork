"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Plan = {
  id: string;
  action: string;
  safetyClass: string;
  status: string;
  risk: string;
  rationale: string;
  requiresApproval: boolean;
  realExecutionEnabled: boolean;
  executableNow: boolean;
  createdByName: string | null;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  rejectedAt: string | null;
  rejectedByName: string | null;
  rejectionReason: string | null;
  expiresAt: string | null;
};

export function RemediationPlanPanel({
  incidentId,
  initialPlans,
  canApprove,
}: {
  incidentId: string;
  initialPlans: Plan[];
  canApprove: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");

  async function post(path: string, body?: unknown) {
    const response = await fetch(
      `/api/incidents/infrastructure/${incidentId}/remediation-plans${path}`,
      {
        method: "POST",
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      },
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
    router.refresh();
    return data;
  }

  async function create() {
    setBusy("create");
    setMessage("");
    try {
      await post("");
      setMessage("Plano criado ou reutilizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar plano.");
    } finally {
      setBusy("");
    }
  }

  async function submit(planId: string) {
    setBusy(`submit:${planId}`);
    setMessage("");
    try {
      await post(`/${planId}/submit`);
      setMessage("Plano enviado para aprovação.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao submeter plano.");
    } finally {
      setBusy("");
    }
  }

  async function decide(planId: string, approve: boolean) {
    setBusy(`${approve ? "approve" : "reject"}:${planId}`);
    setMessage("");
    try {
      await post(`/${planId}/${approve ? "approve" : "reject"}`, {
        reason: reason.trim() || null,
      });
      setReason("");
      setMessage(approve ? "Plano aprovado." : "Plano rejeitado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na decisão.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="remediation-plan-panel">
      <div className="remediation-plan-heading">
        <div>
          <span>Sprint 015.6.11.5.2</span>
          <h2>Approval & Execution Plans</h2>
          <p>
            Persistência e aprovação auditável de planos. Execução real continua
            desabilitada nesta sprint.
          </p>
        </div>
        <div className="remediation-plan-safety">
          <span>Execution Control</span>
          <strong>DISABLED</strong>
        </div>
      </div>

      <div className="remediation-plan-actions">
        <button disabled={!!busy} onClick={create}>
          {busy === "create" ? "Criando..." : "Criar plano da recomendação atual"}
        </button>
        <small>
          Criar plano não executa nenhuma ação no Proxmox.
        </small>
      </div>

      {message ? <div className="remediation-plan-message">{message}</div> : null}

      <div className="remediation-plan-list">
        {initialPlans.map((plan) => (
          <article key={plan.id}>
            <header>
              <div>
                <b>{plan.action}</b>
                <strong>{plan.status}</strong>
                <small>{plan.safetyClass} · risk {plan.risk}</small>
              </div>
              <div>
                <span>Real execution</span>
                <strong>{plan.realExecutionEnabled ? "ENABLED" : "DISABLED"}</strong>
              </div>
            </header>

            <p>{plan.rationale}</p>

            <dl>
              <div><dt>Criado por</dt><dd>{plan.createdByName ?? "Sistema"}</dd></div>
              <div><dt>Approval required</dt><dd>{plan.requiresApproval ? "YES" : "NO"}</dd></div>
              <div><dt>Executable now</dt><dd>{plan.executableNow ? "YES" : "NO"}</dd></div>
              <div><dt>Expires</dt><dd>{plan.expiresAt ? new Date(plan.expiresAt).toLocaleString("pt-BR") : "N/D"}</dd></div>
              <div><dt>Aprovado por</dt><dd>{plan.approvedByName ?? "—"}</dd></div>
            </dl>

            {plan.status === "DRAFT" ? (
              <button
                disabled={!!busy}
                onClick={() => submit(plan.id)}
              >
                {busy === `submit:${plan.id}` ? "Enviando..." : "Enviar para aprovação"}
              </button>
            ) : null}

            {plan.status === "PENDING_APPROVAL" && canApprove ? (
              <div className="remediation-decision">
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Justificativa opcional da decisão..."
                  maxLength={2000}
                />
                <div>
                  <button
                    disabled={!!busy}
                    onClick={() => decide(plan.id, true)}
                  >
                    {busy === `approve:${plan.id}` ? "Aprovando..." : "Aprovar plano"}
                  </button>
                  <button
                    disabled={!!busy}
                    onClick={() => decide(plan.id, false)}
                  >
                    {busy === `reject:${plan.id}` ? "Rejeitando..." : "Rejeitar plano"}
                  </button>
                </div>
              </div>
            ) : null}

            {plan.status === "APPROVED" ? (
              <div className="remediation-plan-approved">
                Plano aprovado, porém execução real permanece BLOQUEADA pela
                política da 015.6.11.5.2.
              </div>
            ) : null}
          </article>
        ))}

        {!initialPlans.length ? (
          <div className="remediation-plan-empty">
            Nenhum plano persistido para este incidente.
          </div>
        ) : null}
      </div>
    </section>
  );
}
