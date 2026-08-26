"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RemediationApprovalRenewalPanel({
  incidentId,
  planId,
  action,
  approvedAt,
  approvedByName,
  expiresAt,
  maxAgeMinutes,
  canRenew,
}: {
  incidentId: string;
  planId: string;
  action: string;
  approvedAt: string;
  approvedByName: string | null;
  expiresAt: string | null;
  maxAgeMinutes: number;
  canRenew: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");

  const ageMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(approvedAt).getTime()) / 60000),
  );
  const stale = ageMinutes > maxAgeMinutes;
  const expired = expiresAt
    ? new Date(expiresAt).getTime() <= Date.now()
    : false;

  async function renew() {
    if (
      !window.confirm(
        `Renovar a aprovação do plano ${action}? Isso não executará nenhuma ação real.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/incidents/infrastructure/${incidentId}/remediation-plans/${planId}/renew-approval`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() || null }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      setReason("");
      setMessage(data.message ?? "Aprovação renovada.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Falha ao renovar aprovação.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="remediation-approval-renewal-panel">
      <div className="remediation-approval-renewal-heading">
        <div>
          <span>Sprint 015.6.11.5.2.1</span>
          <h3>Approval Renewal & Freshness</h3>
          <p>
            Renova aprovação humana expirada para fins de governança, preservando
            o mesmo plano e a trilha de auditoria.
          </p>
        </div>

        <div className={`approval-freshness is-${expired ? "expired" : stale ? "stale" : "fresh"}`}>
          <span>Approval Freshness</span>
          <strong>{expired ? "EXPIRED" : stale ? "STALE" : "FRESH"}</strong>
        </div>
      </div>

      <div className="remediation-approval-renewal-kpis">
        <article><span>Action</span><strong>{action}</strong></article>
        <article><span>Approved by</span><strong>{approvedByName ?? "N/D"}</strong></article>
        <article><span>Age</span><strong>{ageMinutes} min</strong></article>
        <article><span>Max age</span><strong>{maxAgeMinutes} min</strong></article>
      </div>

      {stale && !expired ? (
        <div className="approval-renewal-action">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Justificativa opcional para renovação..."
            maxLength={2000}
          />
          <button
            disabled={busy || !canRenew}
            onClick={renew}
          >
            {busy ? "Renovando..." : "Renovar aprovação"}
          </button>
        </div>
      ) : null}

      {expired ? (
        <small className="approval-renewal-blocked">
          O plano expirou e não pode ser renovado.
        </small>
      ) : null}

      {!stale && !expired ? (
        <small className="approval-renewal-fresh">
          Aprovação ainda válida para a janela atual de governança.
        </small>
      ) : null}

      {message ? (
        <small className="approval-renewal-message">{message}</small>
      ) : null}
    </section>
  );
}
