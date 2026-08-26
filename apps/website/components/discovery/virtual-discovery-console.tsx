"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Result = {
  ok?: boolean;
  error?: string;
  message?: string;
  guests?: number;
  qemuCount?: number;
  lxcCount?: number;
  verifiedCount?: number;
  createdCount?: number;
  updatedCount?: number;
  unchangedCount?: number;
  durationMs?: number;
};

export function VirtualDiscoveryConsole() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setPending(true);
    setResult(null);

    try {
      const response = await fetch(
        "/api/integrations/proxmox/discover-guests",
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
        throw new Error("Sessão redirecionada. Faça login novamente.");
      }

      if (!contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(
          `Resposta inesperada (${response.status}): ${text.slice(0, 120)}`,
        );
      }

      const data = (await response.json()) as Result;

      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? data.message ?? `Falha HTTP ${response.status}.`);
      }

      setResult({ ...data, ok: true });
      router.refresh();
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : "Erro inesperado.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="virtual-discovery-console">
      <button type="button" onClick={run} disabled={pending}>
        {pending ? "Descobrindo VMs e LXCs..." : "Descobrir VMs e Containers"}
      </button>

      {result ? (
        <div className={result.ok === false ? "is-error" : "is-success"}>
          <strong>{result.ok === false ? result.error : result.message}</strong>
          {result.ok !== false ? (
            <small>
              VMs: {result.qemuCount ?? 0} • LXC: {result.lxcCount ?? 0} •
              Verificados: {result.verifiedCount ?? 0} • Novos:{" "}
              {result.createdCount ?? 0} • Alterados: {result.updatedCount ?? 0} •{" "}
              {result.durationMs ?? 0} ms
            </small>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
