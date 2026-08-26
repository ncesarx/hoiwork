"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Instance = {
  id: string;
  name: string;
  site: string | null;
  baseUrl: string;
  tokenId: string;
  allowSelfSigned: boolean;
  enabled: boolean;
  status: string;
  lastHealthAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
};

export function ProxmoxInstanceManager({
  instances,
}: {
  instances: Instance[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    site: "",
    baseUrl: "",
    tokenId: "",
    tokenSecret: "",
    allowSelfSigned: true,
  });

  async function createInstance() {
    setBusy("create");
    setMessage("");

    try {
      const response = await fetch("/api/integrations/proxmox/instances", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      setForm({
        name: "",
        site: "",
        baseUrl: "",
        tokenId: "",
        tokenSecret: "",
        allowSelfSigned: true,
      });
      setMessage("Instância cadastrada com segurança.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao cadastrar.");
    } finally {
      setBusy(null);
    }
  }

  async function action(id: string, kind: "test" | "discover") {
    setBusy(`${kind}:${id}`);
    setMessage("");

    try {
      const response = await fetch(
        `/api/integrations/proxmox/instances/${id}/${kind}`,
        {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      setMessage(
        kind === "test"
          ? `Conexão validada • ${data.nodeCount ?? 0} node(s) • ${data.latencyMs ?? 0} ms`
          : data.message ?? "Discovery concluído.",
      );

      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="multi-proxmox-manager">
      <section className="multi-proxmox-form">
        <div>
          <span>Integration Registry</span>
          <h2>Adicionar novo Proxmox</h2>
          <p>
            Cada instância possui endpoint e credenciais próprios. O Token Secret
            é armazenado criptografado.
          </p>
        </div>

        <div className="multi-proxmox-form__grid">
          <label>
            <span>Nome</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Proxmox Teste"
            />
          </label>

          <label>
            <span>Site</span>
            <input
              value={form.site}
              onChange={(e) => setForm({ ...form, site: e.target.value })}
              placeholder="Lorena / DR / Laboratório"
            />
          </label>

          <label className="is-wide">
            <span>URL</span>
            <input
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://172.30.172.xxx:8006"
            />
          </label>

          <label>
            <span>Token ID</span>
            <input
              value={form.tokenId}
              onChange={(e) => setForm({ ...form, tokenId: e.target.value })}
              placeholder="root@pam!hoiwork"
            />
          </label>

          <label>
            <span>Token Secret</span>
            <input
              type="password"
              value={form.tokenSecret}
              onChange={(e) => setForm({ ...form, tokenSecret: e.target.value })}
              placeholder="••••••••••"
              autoComplete="new-password"
            />
          </label>

          <label className="multi-proxmox-check">
            <input
              type="checkbox"
              checked={form.allowSelfSigned}
              onChange={(e) =>
                setForm({ ...form, allowSelfSigned: e.target.checked })
              }
            />
            <span>Permitir certificado autoassinado</span>
          </label>
        </div>

        <button
          type="button"
          onClick={createInstance}
          disabled={busy === "create"}
        >
          {busy === "create" ? "Cadastrando..." : "Cadastrar Proxmox"}
        </button>
      </section>

      {message ? <div className="multi-proxmox-message">{message}</div> : null}

      <section className="multi-proxmox-list">
        <div className="multi-proxmox-list__heading">
          <div>
            <span>Multi-Proxmox</span>
            <h2>Instâncias cadastradas</h2>
          </div>
          <strong>{instances.length}</strong>
        </div>

        <div className="multi-proxmox-grid">
          {instances.map((instance) => (
            <article key={instance.id}>
              <div className="multi-proxmox-card__top">
                <span>{instance.site || "SITE"}</span>
                <b className={instance.status === "HEALTHY" ? "is-healthy" : "is-warning"}>
                  {instance.status}
                </b>
              </div>

              <h3>{instance.name}</h3>
              <small>{instance.baseUrl}</small>

              <dl>
                <div><dt>Token ID</dt><dd>{instance.tokenId}</dd></div>
                <div><dt>TLS</dt><dd>{instance.allowSelfSigned ? "Self-signed permitido" : "Estrito"}</dd></div>
                <div><dt>Último health</dt><dd>{instance.lastHealthAt ? new Date(instance.lastHealthAt).toLocaleString("pt-BR") : "Nunca"}</dd></div>
                <div><dt>Último sync</dt><dd>{instance.lastSyncAt ? new Date(instance.lastSyncAt).toLocaleString("pt-BR") : "Nunca"}</dd></div>
              </dl>

              {instance.lastError ? (
                <p className="multi-proxmox-error">{instance.lastError}</p>
              ) : null}

              <div className="multi-proxmox-actions">
                <button
                  type="button"
                  onClick={() => action(instance.id, "test")}
                  disabled={busy !== null}
                >
                  {busy === `test:${instance.id}` ? "Testando..." : "Testar conexão"}
                </button>

                <button
                  type="button"
                  onClick={() => action(instance.id, "discover")}
                  disabled={busy !== null}
                >
                  {busy === `discover:${instance.id}` ? "Descobrindo..." : "Discovery completo"}
                </button>
              </div>
            </article>
          ))}

          {!instances.length ? (
            <div className="multi-proxmox-empty">
              Nenhuma instância adicional cadastrada.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
