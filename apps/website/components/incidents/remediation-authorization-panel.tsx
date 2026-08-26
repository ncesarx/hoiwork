"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Authorization = {
  id: string;
  status: string;
  action: string;
  assetName: string;
  nodeName: string | null;
  issuedAt: string;
  expiresAt: string;
  issuedByName: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
};

export function RemediationAuthorizationPanel({
  incidentId,
  planId,
  action,
  governanceDecision,
  authorizations,
  canAuthorize,
}: {
  incidentId: string;
  planId: string;
  action: string;
  governanceDecision: string;
  authorizations: Authorization[];
  canAuthorize: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");

  async function authorize() {
    setBusy("authorize");
    setMessage("");

    try {
      const response = await fetch(
        `/api/incidents/infrastructure/${incidentId}/remediation-plans/${planId}/authorize`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);

      setMessage(
        `${data.message} Token preview: ${data.tokenPreview ?? "N/D"}`,
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha no preflight.",
      );
    } finally {
      setBusy("");
    }
  }

  async function revoke(authorizationId: string) {
    setBusy(`revoke:${authorizationId}`);
    setMessage("");

    try {
      const response = await fetch(
        `/api/incidents/infrastructure/${incidentId}/remediation-plans/${planId}/revoke-authorization`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authorizationId,
            reason: reason.trim() || null,
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);

      setReason("");
      setMessage(data.message ?? "Autorização revogada.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao revogar.",
      );
    } finally {
      setBusy("");
    }
  }

  const active = authorizations.find(
    (item) =>
      item.status === "AUTHORIZED" &&
      !item.revokedAt &&
      new Date(item.expiresAt).getTime() > Date.now(),
  );

  return (
    <section className="remediation-authorization-panel">
      <div className="remediation-authorization-heading">
        <div>
          <span>Sprint 015.6.11.6.2</span>
          <h3>Execution Gate & Preflight Authorization</h3>
          <p>
            Autorização de uso único, TTL curto, binding ao plano/target/ação e
            proteção contra replay. Execução real continua bloqueada.
          </p>
        </div>
        <div>
          <span>Execution Gate</span>
          <strong>{active ? "AUTHORIZED" : "CLOSED"}</strong>
        </div>
      </div>

      <div className="remediation-authorization-kpis">
        <article>
          <span>Governance</span>
          <strong>{governanceDecision}</strong>
        </article>
        <article>
          <span>Action</span>
          <strong>{action}</strong>
        </article>
        <article>
          <span>Authorization</span>
          <strong>{active ? "ACTIVE" : "NONE"}</strong>
        </article>
        <article>
          <span>Real mutation</span>
          <strong>BLOCKED</strong>
        </article>
      </div>

      <div className="remediation-authorization-actions">
        <button
          disabled={
            busy !== "" ||
            !canAuthorize ||
            governanceDecision !== "REAL_EXECUTION_ELIGIBLE" ||
            Boolean(active)
          }
          onClick={authorize}
        >
          {busy === "authorize"
            ? "Executando preflight..."
            : "Executar preflight e emitir autorização"}
        </button>

        <small>
          A autorização emitida ainda não possui executor real conectado.
        </small>
      </div>

      {message ? (
        <small className="remediation-authorization-message">{message}</small>
      ) : null}

      <div className="remediation-authorization-history">
        {authorizations.map((item) => (
          <article key={item.id}>
            <div>
              <b>{item.action}</b>
              <strong>{item.status}</strong>
              <small>
                {item.assetName} · node {item.nodeName ?? "N/D"}
              </small>
            </div>
            <span>{new Date(item.issuedAt).toLocaleString("pt-BR")}</span>
            <span>{new Date(item.expiresAt).toLocaleString("pt-BR")}</span>
            <span>{item.issuedByName ?? "Sistema"}</span>

            {item.status === "AUTHORIZED" && !item.revokedAt ? (
              <div className="remediation-authorization-revoke">
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Motivo opcional..."
                  maxLength={2000}
                />
                <button
                  disabled={busy !== "" || !canAuthorize}
                  onClick={() => revoke(item.id)}
                >
                  {busy === `revoke:${item.id}` ? "Revogando..." : "Revogar"}
                </button>
              </div>
            ) : (
              <small>{item.revokeReason ?? "—"}</small>
            )}
          </article>
        ))}

        {!authorizations.length ? (
          <small>Nenhuma autorização emitida.</small>
        ) : null}
      </div>
    </section>
  );
}
