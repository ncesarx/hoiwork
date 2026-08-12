import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/authz";
import { DiscoveryConsole } from "@/components/discovery/discovery-console";

export const metadata = {
  title: "Infrastructure Discovery | Portal Enterprise",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: Date | null | undefined) {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "—";
}

function formatBytes(value: bigint | null | undefined) {
  if (value == null) return "—";
  let size = Number(value);
  if (!Number.isFinite(size)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit >= 3 ? 1 : 0)} ${units[unit]}`;
}

function formatUptime(value: bigint | null | undefined) {
  if (value == null) return "—";
  const seconds = Number(value);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function statusClass(status: string) {
  return ["ONLINE", "RUNNING", "HEALTHY", "COMPLETED", "INFO"].includes(status)
    ? "is-healthy"
    : ["MISSING", "ERROR", "FAILED", "OFFLINE"].includes(status)
      ? "is-error"
      : "is-warning";
}

export default async function DiscoveryPage() {
  const { organization } = await requireOrganization();

  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_provider: {
        organizationId: organization.id,
        provider: "PROXMOX",
      },
    },
  });

  const [assets, runs] = await Promise.all([
    prisma.infrastructureAsset.findMany({
      where: {
        organizationId: organization.id,
        provider: "PROXMOX",
        assetType: "NODE",
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.discoveryRun.findMany({
      where: {
        organizationId: organization.id,
        provider: "PROXMOX",
        scope: "NODES",
      },
      include: {
        logs: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 8,
    }),
  ]);

  const latest = runs[0];
  const activeAssets = assets.filter((asset) => asset.active);
  const healthyAssets = activeAssets.filter((asset) =>
    ["ONLINE", "RUNNING"].includes(asset.status),
  );

  const discoveryCoverage =
    activeAssets.length > 0
      ? Math.round((healthyAssets.length / activeAssets.length) * 100)
      : 0;

  const integrationHealthy = integration?.status === "HEALTHY";

  return (
    <>
      <section className="portal-heading">
        <span>Enterprise Discovery Center</span>
        <h1>Infraestrutura real do Proxmox</h1>
        <p>
          Inventário operacional alimentado diretamente pelo PostgreSQL após a
          descoberta da infraestrutura Proxmox.
        </p>
      </section>

      <section className="discovery-ui-kpis">
        <article>
          <span>Status da integração</span>
          <strong className={integrationHealthy ? "status-good" : "status-attention"}>
            {integration?.status ?? "NÃO CONFIGURADO"}
          </strong>
          <small>{integration?.mode ?? "—"}</small>
        </article>

        <article>
          <span>Cluster</span>
          <strong>{latest?.clusterName ?? assets[0]?.clusterName ?? "—"}</strong>
          <small>Proxmox VE</small>
        </article>

        <article>
          <span>Nodes descobertos</span>
          <strong>{activeAssets.length}</strong>
          <small>{healthyAssets.length} operacional(is)</small>
        </article>

        <article>
          <span>Discovery Coverage</span>
          <strong>{discoveryCoverage}%</strong>
          <small>Nodes ativos e saudáveis</small>
        </article>

        <article>
          <span>Último Discovery</span>
          <strong>{latest?.status ?? "—"}</strong>
          <small>{formatDate(latest?.completedAt)}</small>
        </article>
      </section>

      <section className="discovery-ui-control">
        <div>
          <span>Real Infrastructure Discovery</span>
          <h2>Sincronização operacional</h2>
          <p>
            A execução consulta o Proxmox, valida os Nodes, persiste os dados e
            só conclui quando os registros são confirmados no PostgreSQL.
          </p>
        </div>
        <DiscoveryConsole />
      </section>

      <section className="discovery-ui-section">
        <div className="discovery-ui-section__heading">
          <div>
            <span>InfrastructureAsset</span>
            <h2>Nodes reais</h2>
          </div>
          <small>{activeAssets.length} ativo(s)</small>
        </div>

        {assets.length ? (
          <div className="discovery-node-grid">
            {assets.map((asset) => (
              <article key={asset.id} className={!asset.active ? "is-inactive" : undefined}>
                <div className="discovery-node-card__top">
                  <span>NODE</span>
                  <b className={statusClass(asset.status)}>{asset.status}</b>
                </div>

                <h3>{asset.name}</h3>
                <small>{asset.clusterName ?? "Proxmox Cluster"}</small>

                <div className="discovery-node-health">
                  <div><span>CPU</span><strong>{formatPercent(asset.cpuPercent)}</strong></div>
                  <div><span>RAM</span><strong>{formatBytes(asset.memoryUsedBytes)}</strong></div>
                  <div><span>Disco</span><strong>{formatBytes(asset.diskUsedBytes)}</strong></div>
                </div>

                <dl>
                  <div><dt>Cores</dt><dd>{asset.cpuCores ?? "—"}</dd></div>
                  <div><dt>RAM total</dt><dd>{formatBytes(asset.memoryTotalBytes)}</dd></div>
                  <div><dt>Disco total</dt><dd>{formatBytes(asset.diskTotalBytes)}</dd></div>
                  <div><dt>Uptime</dt><dd>{formatUptime(asset.uptimeSeconds)}</dd></div>
                  <div><dt>Versão</dt><dd>{asset.version ?? "—"}</dd></div>
                  <div><dt>Última descoberta</dt><dd>{formatDate(asset.lastSeenAt)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <div className="discovery-ui-empty">
            Nenhum Node está registrado em InfrastructureAsset.
          </div>
        )}
      </section>

      <section className="discovery-ui-section">
        <div className="discovery-ui-section__heading">
          <div>
            <span>DiscoveryRun + DiscoveryLog</span>
            <h2>Histórico e auditoria</h2>
          </div>
          <small>Últimas {runs.length} execuções</small>
        </div>

        <div className="discovery-run-list">
          {runs.map((run) => (
            <details key={run.id}>
              <summary>
                <div>
                  <b className={statusClass(run.status)}>{run.status}</b>
                  <strong>{formatDate(run.startedAt)}</strong>
                </div>
                <span>{run.discovered} descoberto(s)</span>
                <span>{run.createdCount} novo(s)</span>
                <span>{run.updatedCount} alterado(s)</span>
                <span>{run.durationMs ?? 0} ms</span>
              </summary>

              <div className="discovery-run-details">
                {run.errorMessage ? (
                  <div className="discovery-run-error">{run.errorMessage}</div>
                ) : null}

                <div className="discovery-log-timeline">
                  {run.logs.map((log) => (
                    <div key={log.id}>
                      <i className={statusClass(log.level)} />
                      <b>{log.step}</b>
                      <span>{log.message}</span>
                      <small>
                        {log.durationMs != null
                          ? `${log.durationMs} ms`
                          : formatDate(log.createdAt)}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}

          {!runs.length ? (
            <div className="discovery-ui-empty">Ainda não existem Discovery Runs.</div>
          ) : null}
        </div>
      </section>
    </>
  );
}
