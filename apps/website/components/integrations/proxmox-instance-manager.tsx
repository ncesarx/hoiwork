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
  canRotateCredentials = false,
}: {
  instances: Instance[];
  canRotateCredentials?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [credentialEditId, setCredentialEditId] = useState<string | null>(null);
  const [credentialForm, setCredentialForm] = useState({ tokenId: "", tokenSecret: "" });
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


  function toggleCredentials(instance: Instance) {
    setMessage("");
    if (credentialEditId === instance.id) {
      setCredentialEditId(null);
      setCredentialForm({ tokenId: "", tokenSecret: "" });
    } else {
      setCredentialEditId(instance.id);
      setCredentialForm({ tokenId: instance.tokenId, tokenSecret: "" });
    }
  }

  async function rotateCredentials(instance: Instance) {
    if (!credentialForm.tokenId.trim() || !credentialForm.tokenSecret.trim()) {
      setMessage("Informe Token ID e o novo Token Secret.");
      return;
    }

    setBusy(`credentials:${instance.id}`);
    setMessage("");
    try {
      const response = await fetch(
        `/api/integrations/proxmox/instances/${instance.id}/credentials`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          cache: "no-store",
          body: JSON.stringify(credentialForm),
        },
      );
      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      setMessage(`Token validado e salvo para "${instance.name}" (${data.nodeCount} node(s)).`);
      setCredentialEditId(null);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar credenciais.");
    } finally {
      setCredentialForm((previous) => ({ ...previous, tokenSecret: "" }));
      setBusy(null);
    }
  }

  async function removeInstance(instance: Instance) {
    const confirmed = window.confirm(
      `Remover a instância "${instance.name}"?\n\n` +
      `${instance.baseUrl}\n\n` +
      "O cadastro e as credenciais desta instância serão removidos do Integration Registry. " +
      "Esta ação não pode ser desfeita.",
    );

    if (!confirmed) {
      return;
    }

    setBusy(`delete:${instance.id}`);
    setMessage("");

    try {
      const response = await fetch(
        `/api/integrations/proxmox/instances/${instance.id}`,
        {
          method: "DELETE",
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
        data.message ?? `Instância "${instance.name}" removida com sucesso.`,
      );

      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro ao remover instância Proxmox.",
      );
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

                {canRotateCredentials ? (
                  <button
                    type="button"
                    onClick={() => toggleCredentials(instance)}
                    disabled={busy !== null}
                  >
                    {credentialEditId === instance.id ? "Cancelar troca" : "Trocar token"}
                  </button>
                ) : null}

                <button
                  type="button"
                  className="is-danger"
                  onClick={() => removeInstance(instance)}
                  disabled={busy !== null}
                >
                  {busy === `delete:${instance.id}` ? "Removendo..." : "Remover"}
                </button>
              </div>

              {canRotateCredentials && credentialEditId === instance.id ? (
                <div className="multi-proxmox-credential-form">
                  <p>O novo token será testado antes de substituir o atual. O Token Secret não é exibido após salvar.</p>
                  <label>
                    <span>Token ID</span>
                    <input
                      value={credentialForm.tokenId}
                      onChange={(event) => setCredentialForm({ ...credentialForm, tokenId: event.target.value })}
                      disabled={busy !== null}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    <span>Novo Token Secret</span>
                    <input
                      type="password"
                      value={credentialForm.tokenSecret}
                      onChange={(event) => setCredentialForm({ ...credentialForm, tokenSecret: event.target.value })}
                      disabled={busy !== null}
                      autoComplete="new-password"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => rotateCredentials(instance)}
                    disabled={busy !== null || !credentialForm.tokenId.trim() || !credentialForm.tokenSecret.trim()}
                  >
                    {busy === `credentials:${instance.id}` ? "Validando..." : "Validar e salvar token"}
                  </button>
                </div>
              ) : null}
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
