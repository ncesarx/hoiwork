import type { ProxmoxInstanceClient } from "@/integrations/proxmox/instance-client";

export type SnapshotClient = Pick<
  ProxmoxInstanceClient,
  "version" | "nodes" | "guests" | "storages" | "clusterStatus" | "network"
>;

export async function collectProxmoxSnapshot(client: SnapshotClient) {
  const version = await client.version();
  const [nodes, guests, storages, clusterStatus] = await Promise.all([
    client.nodes(),
    client.guests(),
    client.storages(),
    client.clusterStatus().catch(() => []),
  ]);

  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error("A API Proxmox não retornou nós; inventário anterior preservado.");
  }
  if (!Array.isArray(guests) || !Array.isArray(storages)) {
    throw new Error("A API Proxmox retornou uma lista inválida de recursos.");
  }

  const networksByNode = await Promise.all(nodes.map(async (node) => {
    const interfaces = await client.network(node.node);
    if (!Array.isArray(interfaces)) {
      throw new Error(`A API Proxmox retornou uma lista inválida de redes para ${node.node}.`);
    }
    return { nodeName: node.node, interfaces };
  }));

  return { version, nodes, guests, storages, clusterStatus, networksByNode };
}
