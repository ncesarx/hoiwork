import Link from "next/link";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  buildProxmoxInventory,
  type InventoryResource,
} from "@/lib/inventory/proxmox-topology";
import { DEMO_ASSET_IDS } from "@/lib/inventory/demo-assets";
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
}: {
  title: string;
  resources: InventoryResource[];
}) {
  if (!resources.length) return null;
  return (
    <div className="inventory-resource-list">
      <h4>
        {title} <span>{resources.length}</span>
      </h4>
      <ul>
        {resources.map((resource) => (
          <li key={resource.key}>
            <span>
              <strong>{resource.name}</strong>
              {resource.vmid != null && <small>VMID {resource.vmid}</small>}
            </span>
            <span className="inventory-resource-state">
              {resource.type} · {resource.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatSync(date: Date | null) {
  if (!date) return "Ainda não sincronizado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
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

      {inventory.map((cluster) => (
        <section className="inventory-cluster" key={cluster.key}>
          <header>
            <div>
              <span>Cluster Proxmox</span>
              <h2>
                {cluster.nodes.map((node) => node.resource.name).join(" + ") ||
                  "Armazenamento"}
              </h2>
            </div>
            <small>
              {cluster.endpoints.length} endpoint(s) · {cluster.nodes.length}{" "}
              nó(s)
            </small>
          </header>
          <p className="inventory-endpoints">
            Endpoints:{" "}
            {cluster.endpoints
              .map((endpoint) =>
                `${endpoint.name} (${endpoint.baseUrl}; última sincronização: ${formatSync(endpoint.lastSyncAt)})`,
              )
              .join(" · ")}
          </p>
          <div className="inventory-node-grid">
            {cluster.nodes.map((node) => (
              <article key={node.resource.key} className="inventory-node">
                <div className="inventory-node-heading">
                  <div>
                    <span>Nó Proxmox</span>
                    <h3>{node.resource.name}</h3>
                  </div>
                  <strong>{node.resource.status}</strong>
                </div>
                <ResourceList
                  title="Máquinas virtuais e contêineres"
                  resources={node.guests}
                />
                <ResourceList title="Storages" resources={node.storages} />
                <ResourceList
                  title="Interfaces de rede"
                  resources={node.networks}
                />
              </article>
            ))}
          </div>
          <ResourceList
            title="Storages do cluster"
            resources={cluster.clusterStorages}
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
