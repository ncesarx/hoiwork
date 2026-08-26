import { prisma } from "@/lib/prisma";

export type SiteTopology = {
  instance: {
    id: string;
    name: string;
    site: string | null;
    baseUrl: string;
    status: string;
    lastSyncAt: Date | null;
  };
  nodes: Array<{
    externalId: string;
    name: string;
    status: string;
    cpuPercent: number | null;
  }>;
  groups: Array<{
    nodeExternalId: string;
    nodeName: string;
    guests: Array<{ externalId: string; name: string; type: string; status: string }>;
    storages: Array<{ externalId: string; name: string; status: string }>;
    networks: Array<{ externalId: string; name: string; status: string }>;
  }>;
  counts: {
    nodes: number;
    vms: number;
    lxcs: number;
    storages: number;
    networks: number;
    assets: number;
  };
};

export async function buildMultiSiteTopology(organizationId: string) {
  const instances = await prisma.proxmoxInstance.findMany({
    where: { organizationId, enabled: true },
    orderBy: [{ site: "asc" }, { name: "asc" }],
  });

  const assets = await prisma.infrastructureAsset.findMany({
    where: {
      organizationId,
      provider: "PROXMOX",
      active: true,
      externalId: { startsWith: "proxmox/" },
    },
    orderBy: [{ assetType: "asc" }, { name: "asc" }],
  });

  const sites: SiteTopology[] = instances.map((instance) => {
    const prefix = `proxmox/${instance.id}/`;
    const scoped = assets.filter((asset) => asset.externalId.startsWith(prefix));
    const nodeAssets = scoped.filter((asset) => asset.assetType === "NODE");

    const groups = nodeAssets.map((node) => ({
      nodeExternalId: node.externalId,
      nodeName: node.name,
      guests: scoped
        .filter(
          (asset) =>
            asset.parentExternalId === node.externalId &&
            (asset.assetType === "VM" || asset.assetType === "LXC"),
        )
        .map((asset) => ({
          externalId: asset.externalId,
          name: asset.name,
          type: asset.assetType,
          status: asset.status,
        })),
      storages: scoped
        .filter(
          (asset) =>
            asset.parentExternalId === node.externalId &&
            asset.assetType === "STORAGE",
        )
        .map((asset) => ({
          externalId: asset.externalId,
          name: asset.name,
          status: asset.status,
        })),
      networks: scoped
        .filter(
          (asset) =>
            asset.parentExternalId === node.externalId &&
            asset.assetType === "NETWORK",
        )
        .map((asset) => ({
          externalId: asset.externalId,
          name: asset.name,
          status: asset.status,
        })),
    }));

    return {
      instance: {
        id: instance.id,
        name: instance.name,
        site: instance.site,
        baseUrl: instance.baseUrl,
        status: instance.status,
        lastSyncAt: instance.lastSyncAt,
      },
      nodes: nodeAssets.map((node) => ({
        externalId: node.externalId,
        name: node.name,
        status: node.status,
        cpuPercent: node.cpuPercent,
      })),
      groups,
      counts: {
        nodes: nodeAssets.length,
        vms: scoped.filter((asset) => asset.assetType === "VM").length,
        lxcs: scoped.filter((asset) => asset.assetType === "LXC").length,
        storages: scoped.filter((asset) => asset.assetType === "STORAGE").length,
        networks: scoped.filter((asset) => asset.assetType === "NETWORK").length,
        assets: scoped.length,
      },
    };
  });

  return {
    sites,
    totals: {
      instances: instances.length,
      healthyInstances: instances.filter((instance) => instance.status === "HEALTHY").length,
      nodes: sites.reduce((sum, site) => sum + site.counts.nodes, 0),
      vms: sites.reduce((sum, site) => sum + site.counts.vms, 0),
      lxcs: sites.reduce((sum, site) => sum + site.counts.lxcs, 0),
      storages: sites.reduce((sum, site) => sum + site.counts.storages, 0),
      networks: sites.reduce((sum, site) => sum + site.counts.networks, 0),
      assets: sites.reduce((sum, site) => sum + site.counts.assets, 0),
    },
  };
}
