"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SyncResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  resources?: number;
};

export function SyncButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function sync() {
    setPending(true);
    setMessage("Iniciando sincronização...");

    try {
      const response = await fetch(
        "/api/integrations/proxmox/sync",
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
          redirect: "manual",
        },
      );

      const contentType = response.headers.get("content-type");
      let data: SyncResponse = {};

      if (contentType?.includes("application/json")) {
        data = (await response.json()) as SyncResponse;
      } else {
        const text = await response.text();
        data = { error: text || "Resposta não reconhecida." };
      }

      if (response.status === 307 || response.status === 302) {
        throw new Error(
          "A sessão não foi reconhecida. Saia do Portal e faça login novamente.",
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            `Falha HTTP ${response.status}.`,
        );
      }

      setMessage(
        data.resources !== undefined
          ? `${data.resources} recursos sincronizados.`
          : data.message || "Sincronização concluída.",
      );

      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro inesperado durante a sincronização.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="integration-sync">
      <button
        type="button"
        onClick={sync}
        disabled={pending}
      >
        {pending ? "Sincronizando..." : "Sincronizar Proxmox"}
      </button>

      {message ? <small>{message}</small> : null}
    </div>
  );
}
