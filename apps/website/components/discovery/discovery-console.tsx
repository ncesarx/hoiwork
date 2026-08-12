"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DiscoveryResponse = {
  ok?: boolean;
  stage?: string;
  error?: string;
  message?: string;
  runId?: string;
  clusterName?: string;
  version?: string;
  nodes?: number;
  verifiedCount?: number;
  createdCount?: number;
  updatedCount?: number;
  unchangedCount?: number;
  offlineCount?: number;
  durationMs?: number;
};

export function DiscoveryConsole() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<DiscoveryResponse | null>(null);

  async function runDiscovery() {
      try {
  const response = await fetch(
    "/api/integrations/proxmox/discover-nodes",
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
      redirect: "manual",
    },
  );

      const contentType = response.headers.get("content-type") ?? "";

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        throw new Error(
          "A requisição foi redirecionada. Faça login novamente e repita o Discovery.",
        );
      }

      if (!contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(
          `Resposta inesperada da API (${response.status}). Esperado JSON, recebido: ${
            text.slice(0, 120) || "corpo vazio"
          }`,
        );
      }

      const data = (await response.json()) as DiscoveryResponse;
      if (!response.ok || data.ok === false) {
        throw new Error(
          data.error ??
            data.message ??
            `Falha HTTP ${response.status} durante o Discovery.`,
        );
      }

      setResult({ ...data, ok: true, stage: "completed" });
      router.refresh();
    } catch (error) {
      setResult({
        ok: false,
        stage: "error",
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado durante a descoberta.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="discovery-console">
      <button
        type="button"
        onClick={runDiscovery}
        disabled={pending}
        className="discovery-console__button"
      >
        {pending ? "Descobrindo infraestrutura..." : "Descobrir Nodes Reais"}
      </button>

      {result ? (
        <div
          className={[
            "discovery-console__result",
            result.ok === false ? "is-error" : "is-success",
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          <strong>
            {result.ok === false
              ? result.error
              : result.message ?? "Discovery concluído."}
          </strong>

          {result.ok !== false && result.stage === "completed" ? (
            <div className="discovery-console__metrics">
              <span>Cluster: {result.clusterName ?? "—"}</span>
              <span>Versão: {result.version ?? "—"}</span>
              <span>Nodes: {result.nodes ?? 0}</span>
              <span>Confirmados: {result.verifiedCount ?? 0}</span>
              <span>Novos: {result.createdCount ?? 0}</span>
              <span>Alterados: {result.updatedCount ?? 0}</span>
              <span>Sem mudanças: {result.unchangedCount ?? 0}</span>
              <span>Duração: {result.durationMs ?? 0} ms</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
