import Link from "next/link";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  buildProxmoxInventory,
  hasRecentStatusConflict,
  type InventoryResource,
} from "@/lib/inventory/proxmox-topology";
import { DEMO_ASSET_IDS } from "@/lib/inventory/demo-assets";
import {
  COLLECTION_RECENT_MINUTES,
  collectionFreshness,
  formatCollectionTime,
  type CollectionFreshness,
} from "@/lib/inventory/freshness";
import "./inventory.css";

export const metadata = {
  title: "Inventário | Portal Enterprise",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string; type?: string }> };

function matches(resource: InventoryResource, query: string, type: string) {
  if (
    type !== "ALL" &&
    resource.type !== type &&
    !(type === "SERVER" && resource.type === "NODE")
  )
    return false;
  if (!query) return true;
  return [
    resource.name,
    resource.nodeName,
    resource.ipAddress,
    resource.vmid?.toString(),
  ].some((value) => value?.toLocaleLowerCase("pt-BR").includes(query));
}

function ResourceList({
  title,
  resources,
  evaluatedAt,
}: {
  title: string;
  resources: InventoryResource[];
  evaluatedAt: Date;
}) {
  if (!resources.length) return null;
  return (
    <div className="inventory-resource-list">
      <h4>
        {title} <span>{resources.length}</span>
      </h4>
      <ul>
        {resources.map((resource) => {
          const freshness = collectionFreshness(resource.lastSeenAt, evaluatedAt);
          const conflict = hasRecentStatusConflict(resource, evaluatedAt);
          return (
            <li key={resource.key}>
              <div className="inventory-resource-description">
                <strong>{resource.name}</strong>
                <small>
                  {resource.vmid != null && <>VMID {resource.vmid} · </>}
                  visto em {formatCollectionTime(resource.lastSeenAt)}
                </small>
                <ResourceEvidence resource={resource} evaluatedAt={evaluatedAt} />
              </div>
              <span className={`inventory-resource-state${freshness === "RECENT" && !conflict ? "" : " is-stale"}`}>
                {resource.type} · {resource.status}
                {freshness !== "RECENT" && ` · ${freshnessLabel(freshness)}`}
                {conflict && " · estados divergentes"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ResourceEvidence({ resource, evaluatedAt }: {
  resource: InventoryResource;
  evaluatedAt: Date;
}) {
  return (
    <div className="inventory-evidence">
      <small>Origem do estado: {resource.sourceInstanceName}</small>
      {resource.observations.length > 1 && (
        <details className="inventory-observations">
          <summary>
            {hasRecentStatusConflict(resource, evaluatedAt)
              ? "Comparar estados divergentes"
              : `Comparar ${resource.observations.length} endpoints`}
          </summary>
          <ul>
            {resource.observations.map((observation) => (
              <li key={observation.instanceId}>
                {observation.instanceName}: {observation.status} · {formatCollectionTime(observation.lastSeenAt)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function freshnessLabel(freshness: CollectionFreshness) {
  switch (freshness) {
    case "RECENT": return "recente";
    case "STALE": return "coleta antiga";
    case "NO_DATA": return "sem coleta";
    case "CLOCK_SKEW": return "horário divergente";
  }
}

export default async function Page({ searchParams }: Props) {
  const { organization } = await requireOrganization();
  const p = await searchParams;
  const query = p.q?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const type = p.type ?? "ALL";

  const [instances, resources, registeredAssets] = await Promise.all([
    prisma.proxmoxInstance.findMany({
      where: { organizationId: organization.id, enabled: true },
      select: {
        id: true,
        name: true,
        site: true,
        baseUrl: true,
        status: true,
        lastSyncAt: true,
      },
    }),
    prisma.infrastructureAsset.findMany({
      where: {
        organizationId: organization.id,
        provider: "PROXMOX",
        active: true,
        externalId: { startsWith: "proxmox/" },
      },
      select: {
        externalId: true,
        clusterName: true,
        assetType: true,
        name: true,
        nodeName: true,
        status: true,
        ipAddress: true,
        metadata: true,
        lastSeenAt: true,
      },
    }),
    prisma.asset.findMany({
      where: {
        organizationId: organization.id,
        id: {
          notIn: DEMO_ASSET_IDS,
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const evaluatedAt = new Date();

  const clusters = buildProxmoxInventory(instances, resources);
  const inventory = clusters
    .map((cluster) => ({
      ...cluster,
      nodes: cluster.nodes
        .map((node) => ({
          ...node,
          guests: node.guests.filter((resource) =>
            matches(resource, query, type),
          ),
          storages: node.storages.filter((resource) =>
            matches(resource, query, type),
          ),
          networks: node.networks.filter((resource) =>
            matches(resource, query, type),
          ),
        }))
        .filter(
          (node) =>
            matches(node.resource, query, type) ||
            node.guests.length > 0 ||
            node.storages.length > 0 ||
            node.networks.length > 0,
        ),
      clusterStorages: cluster.clusterStorages.filter((resource) =>
        matches(resource, query, type),
      ),
    }))
    .filter(
      (cluster) => cluster.nodes.length || cluster.clusterStorages.length,
    );

  const assets = registeredAssets.filter(
    (asset) =>
      (type === "ALL" || asset.type === type) &&
      (!query ||
        [
          asset.name,
          asset.manufacturer,
          asset.model,
          asset.serialNumber,
          asset.ipAddress,
        ].some((value) => value?.toLocaleLowerCase("pt-BR").includes(query))),
  );

  return (
    <>
      <section className="portal-heading">
        <span>Recursos descobertos</span>
        <h1>Inventário corporativo</h1>
        <p>
          Nós, VMs, contêineres, armazenamento e redes do Proxmox, agrupados por
          cluster.
        </p>
      </section>
      <form className="data-filters">
        <input
          name="q"
          defaultValue={p.q}
          placeholder="Pesquisar nome, nó, VMID ou IP"
        />
        <select name="type" defaultValue={type}>
          <option value="ALL">Todos</option>
          <option value="NODE">Nós Proxmox</option>
          <option value="VM">VMs</option>
          <option value="LXC">Contêineres</option>
          <option value="STORAGE">Storages</option>
          <option value="NETWORK">Redes</option>
          <option value="SERVER">Servidores</option>
          <option value="FIREWALL">Firewalls</option>
          <option value="SWITCH">Switches</option>
        </select>
        <button>Filtrar</button>
      </form>

      {instances.length > 0 && (
        <section className="inventory-collection" aria-label="Atualização das fontes Proxmox">
          <h2>Atualização Proxmox</h2>
          <p>Coleta recente: até {COLLECTION_RECENT_MINUTES} minutos. Estados antigos são apresentados como último registro conhecido.</p>
          <ul>
            {instances.map((instance) => {
              const freshness = collectionFreshness(instance.lastSyncAt, evaluatedAt);
              return (
                <li key={instance.id}>
                  <strong>{instance.name}</strong>
                  <span className={freshness === "RECENT" ? "" : "is-stale"}>
                    {freshnessLabel(freshness)} · {formatCollectionTime(instance.lastSyncAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {inventory.map((cluster) => (
        <section className="inventory-cluster" key={cluster.key}>
          <header>
            <div>
              <span>{cluster.clusterName ? "Cluster Proxmox" : "Endpoint Proxmox · cluster não identificado"}</span>
              <h2>
                {cluster.clusterName ?? cluster.endpoints[0]?.name ?? "Proxmox"}
              </h2>
            </div>
            <small>
              {cluster.endpoints.length} endpoint(s) · {cluster.nodes.length}{" "}
              nó(s)
            </small>
          </header>
          {!cluster.clusterName && (
            <p className="inventory-endpoints">
              A API não retornou a identidade do cluster nesta coleta. Este endpoint é exibido separadamente.
            </p>
          )}
          <p className="inventory-endpoints">
            Endpoints:{" "}
            {cluster.endpoints
              .map((endpoint) =>
                `${endpoint.name} (${endpoint.baseUrl})`,
              )
              .join(" · ")}
          </p>
          <div className="inventory-node-grid">
            {cluster.nodes.map((node) => {
              const freshness = collectionFreshness(node.resource.lastSeenAt, evaluatedAt);
              const conflict = hasRecentStatusConflict(node.resource, evaluatedAt);
              return (
                <article key={node.resource.key} className="inventory-node">
                  <div className="inventory-node-heading">
                    <div>
                      <span>Nó Proxmox</span>
                      <h3>{node.resource.name}</h3>
                      <small>Visto em {formatCollectionTime(node.resource.lastSeenAt)}</small>
                    </div>
                    <strong className={freshness === "RECENT" && !conflict ? "" : "is-stale"}>
                      {node.resource.status}
                      {freshness !== "RECENT" && ` · ${freshnessLabel(freshness)}`}
                      {conflict && " · estados divergentes"}
                    </strong>
                  </div>
                  <ResourceEvidence resource={node.resource} evaluatedAt={evaluatedAt} />
                  <ResourceList
                    title="Máquinas virtuais e contêineres"
                    resources={node.guests}
                    evaluatedAt={evaluatedAt}
                  />
                  <ResourceList title="Storages" resources={node.storages} evaluatedAt={evaluatedAt} />
                  <ResourceList
                    title="Interfaces de rede"
                    resources={node.networks}
                    evaluatedAt={evaluatedAt}
                  />
                </article>
              );
            })}
          </div>
          <ResourceList
            title="Storages do cluster"
            resources={cluster.clusterStorages}
            evaluatedAt={evaluatedAt}
          />
        </section>
      ))}

      {assets.length > 0 && (
        <section className="inventory-manual">
          <h2>Ativos cadastrados</h2>
          <div className="data-assets">
            {assets.map((asset) => (
              <article key={asset.id}>
                <div>
                  <span>{asset.type}</span>
                  <b>{asset.status}</b>
                </div>
                <h2>{asset.name}</h2>
                <dl>
                  <div>
                    <dt>Fabricante</dt>
                    <dd>{asset.manufacturer ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Modelo</dt>
                    <dd>{asset.model ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>IP</dt>
                    <dd>{asset.ipAddress ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Localização</dt>
                    <dd>{asset.location ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Série</dt>
                    <dd>{asset.serialNumber ?? "—"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}
      {!inventory.length && !assets.length && (
        <p className="data-empty">
          {query || type !== "ALL" ? (
            "Nenhum recurso corresponde aos filtros."
          ) : (
            <>
              Nenhum recurso descoberto.{" "}
              <Link href="/portal/integracoes/proxmox">
                Sincronize a integração Proxmox
              </Link>
              .
            </>
          )}
        </p>
      )}
    </>
  );
}
