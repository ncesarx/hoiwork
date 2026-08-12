import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { DiscoveryActions } from "@/components/discovery/discovery-actions";

export const metadata = {
  title: "Infrastructure Discovery | Portal Enterprise",
  robots: { index: false, follow: false },
};

function percent(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "—";
}

function bytes(value: bigint | null | undefined) {
  if (value == null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = n;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size.toFixed(index >= 3 ? 1 : 0)} ${units[index]}`;
}

function duration(seconds: bigint | null | undefined) {
  if (seconds == null) return "—";
  const total = Number(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  return `${days}d ${hours}h`;
}

function date(value: Date | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(value)
    : "Nunca";
}

export default async function DiscoveryPage() {
  const { organization } = await requireOrganization();

  const [assets, runs] = await Promise.all([
    prisma.infrastructureAsset.findMany({
      where: {
        organizationId: organization.id,
        provider: "PROXMOX",
        assetType: "NODE",
        active: true,
      },
      orderBy: { name: "asc" },
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
      take: 5,
    }),
  ]);

  const latest = runs[0];
  const healthy = assets.filter((asset) =>
    ["ONLINE", "RUNNING"].includes(asset.status),
  ).length;
  const coverage = assets.length ? 100 : 0;

  return (
    <>
      <section className="portal-heading">
        <span>Enterprise Discovery Framework</span>
        <h1>Real Infrastructure Discovery</h1>
        <p>
          Descoberta de Nodes reais do Proxmox, persistência no PostgreSQL e
          auditoria completa do pipeline.
        </p>
      </section>

      <section className="discovery-kpis">
        <article><span>Cluster</span><strong>{latest?.clusterName ?? "—"}</strong></article>
        <article><span>Nodes</span><strong>{assets.length}</strong></article>
        <article><span>Saudáveis</span><strong>{healthy}</strong></article>
        <article><span>Coverage</span><strong>{coverage}%</strong></article>
        <article><span>Último Discovery</span><strong>{date(latest?.completedAt)}</strong></article>
      </section>

      <section className="discovery-control">
        <div>
          <span>Sprint 015.6.1</span>
          <h2>Discovery Engine + Nodes</h2>
          <p>
            Esta fase coleta apenas Nodes reais. VMs, LXCs, Storage e Network
            entram nas próximas fases.
          </p>
        </div>
        <DiscoveryActions />
      </section>

      <section className="discovery-assets">
        {assets.map((asset) => (
          <article key={asset.id}>
            <div className="discovery-assets__top">
              <span>NODE</span>
              <b>{asset.status}</b>
            </div>
            <h2>{asset.name}</h2>
            <small>{asset.clusterName ?? "Proxmox Cluster"}</small>

            <dl>
              <div><dt>CPU</dt><dd>{percent(asset.cpuPercent)}</dd></div>
              <div><dt>Cores</dt><dd>{asset.cpuCores ?? "—"}</dd></div>
              <div><dt>RAM usada</dt><dd>{bytes(asset.memoryUsedBytes)}</dd></div>
              <div><dt>RAM total</dt><dd>{bytes(asset.memoryTotalBytes)}</dd></div>
              <div><dt>Disco usado</dt><dd>{bytes(asset.diskUsedBytes)}</dd></div>
              <div><dt>Disco total</dt><dd>{bytes(asset.diskTotalBytes)}</dd></div>
              <div><dt>Uptime</dt><dd>{duration(asset.uptimeSeconds)}</dd></div>
              <div><dt>Versão</dt><dd>{asset.version ?? "—"}</dd></div>
              <div><dt>Última descoberta</dt><dd>{date(asset.lastSeenAt)}</dd></div>
            </dl>
          </article>
        ))}
      </section>

      {!assets.length ? (
        <p className="discovery-empty">
          Nenhum Node real descoberto ainda. Execute “Descobrir Nodes Reais”.
        </p>
      ) : null}

      <section className="discovery-history">
        <div className="portal-panel__header">
          <div>
            <span>Auditoria</span>
            <h2>Discovery Runs</h2>
          </div>
        </div>

        {runs.map((run) => (
          <details key={run.id}>
            <summary>
              <span>
                <strong>{run.status}</strong>
                <small>{date(run.startedAt)}</small>
              </span>
              <span>{run.discovered} node(s)</span>
              <span>{run.durationMs ?? 0} ms</span>
            </summary>

            <div className="discovery-log">
              {run.logs.map((log) => (
                <div key={log.id}>
                  <b>{log.step}</b>
                  <span>{log.message}</span>
                  <small>{log.durationMs != null ? `${log.durationMs} ms` : ""}</small>
                </div>
              ))}
            </div>
          </details>
        ))}
      </section>
    </>
  );
}
