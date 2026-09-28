import type { InfrastructureAsset, ProxmoxInstance } from "@prisma/client";

type Asset = Pick<
  InfrastructureAsset,
  | "externalId"
  | "assetType"
  | "name"
  | "nodeName"
  | "status"
  | "ipAddress"
  | "metadata"
  | "lastSeenAt"
>;

type Instance = Pick<
  ProxmoxInstance,
  "id" | "name" | "site" | "baseUrl" | "status" | "lastSyncAt"
>;

export type InventoryResource = {
  key: string;
  type: string;
  name: string;
  nodeName: string | null;
  status: string;
  ipAddress: string | null;
  vmid: number | null;
  lastSeenAt: Date;
};

export type InventoryCluster = {
  key: string;
  endpoints: Instance[];
  nodes: Array<{
    resource: InventoryResource;
    guests: InventoryResource[];
    storages: InventoryResource[];
    networks: InventoryResource[];
  }>;
  clusterStorages: InventoryResource[];
};

function resourceId(asset: Asset, instanceId: string) {
  const metadata = asset.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const sourceId = (metadata as Record<string, unknown>).sourceExternalId;
    if (typeof sourceId === "string") return sourceId;
  }
  return asset.externalId.slice(`proxmox/${instanceId}/`.length);
}

// Endpoints with the same node membership describe the same cluster. Keep the
// database's per-endpoint evidence intact and consolidate only the inventory.
export function buildProxmoxInventory(
  instances: Instance[],
  assets: Asset[],
): InventoryCluster[] {
  const clusters = new Map<
    string,
    { endpoints: Instance[]; resources: Map<string, InventoryResource> }
  >();

  for (const instance of instances) {
    const prefix = `proxmox/${instance.id}/`;
    const scoped = assets.filter((asset) =>
      asset.externalId.startsWith(prefix),
    );
    const memberNames = [
      ...new Set(
        scoped
          .filter((asset) => asset.assetType === "NODE")
          .map((asset) => asset.name.toLowerCase()),
      ),
    ].sort();
    if (memberNames.length === 0) continue;

    const key = JSON.stringify(memberNames);
    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = { endpoints: [], resources: new Map() };
      clusters.set(key, cluster);
    }
    cluster.endpoints.push(instance);

    for (const asset of scoped) {
      if (
        !["NODE", "VM", "LXC", "STORAGE", "NETWORK"].includes(asset.assetType)
      )
        continue;
      const sourceId = resourceId(asset, instance.id);
      const resourceKey = `${asset.assetType}:${sourceId}`;
      const previous = cluster.resources.get(resourceKey);
      if (previous && previous.lastSeenAt >= asset.lastSeenAt) continue;

      const metadata = asset.metadata;
      const vmid =
        metadata && typeof metadata === "object" && !Array.isArray(metadata)
          ? (metadata as Record<string, unknown>).vmid
          : null;
      cluster.resources.set(resourceKey, {
        key: `${key}:${resourceKey}`,
        type: asset.assetType,
        name: asset.name,
        nodeName: asset.nodeName,
        status: asset.status,
        ipAddress: asset.ipAddress,
        vmid: typeof vmid === "number" ? vmid : null,
        lastSeenAt: asset.lastSeenAt,
      });
    }
  }

  return [...clusters].map(([key, cluster]) => {
    const resources = [...cluster.resources.values()];
    const byName = (a: InventoryResource, b: InventoryResource) =>
      a.name.localeCompare(b.name);
    const nodes = resources
      .filter((resource) => resource.type === "NODE")
      .sort(byName)
      .map((node) => ({
        resource: node,
        guests: resources
          .filter(
            (resource) =>
              ["VM", "LXC"].includes(resource.type) &&
              resource.nodeName === node.name,
          )
          .sort((a, b) => (a.vmid ?? 0) - (b.vmid ?? 0)),
        storages: resources
          .filter(
            (resource) =>
              resource.type === "STORAGE" && resource.nodeName === node.name,
          )
          .sort(byName),
        networks: resources
          .filter(
            (resource) =>
              resource.type === "NETWORK" && resource.nodeName === node.name,
          )
          .sort(byName),
      }));

    return {
      key,
      endpoints: cluster.endpoints,
      nodes,
      clusterStorages: resources
        .filter((resource) => resource.type === "STORAGE" && !resource.nodeName)
        .sort(byName),
    };
  });
}
