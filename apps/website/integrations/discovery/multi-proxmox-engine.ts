import { prisma } from "@/lib/prisma";
import { decryptCredential } from "@/lib/proxmox/credentials";
import { ProxmoxInstanceClient } from "@/integrations/proxmox/instance-client";

function ns(instanceId: string, externalId: string) {
  return `proxmox/${instanceId}/${externalId}`;
}

function j(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value));
}

export async function discoverProxmoxInstance(params: {
  organizationId: string;
  instanceId: string;
}) {
  const instance = await prisma.proxmoxInstance.findFirst({
    where: {
      id: params.instanceId,
      organizationId: params.organizationId,
      enabled: true,
    },
  });

  if (!instance) {
      throw new Error("Instância Proxmox não encontrada ou desabilitada.");
  }

  const currentInstance = instance;

  const client = new ProxmoxInstanceClient({
    baseUrl: instance.baseUrl,
    tokenId: instance.tokenId,
    tokenSecret: decryptCredential(instance.tokenSecretEncrypted),
    allowSelfSigned: instance.allowSelfSigned,
  });

  const version = await client.version();
  const [nodes, guests, storages] = await Promise.all([
    client.nodes(),
    client.guests(),
    client.storages(),
  ]);

  const now = new Date();
  const discoveredExternalIds: string[] = [];
  let createdCount = 0;
  let updatedCount = 0;

  async function save(asset: {
    externalId: string;
    assetType: string;
    name: string;
    status: string;
    nodeName?: string;
    parentExternalId?: string;
    cpuPercent?: number;
    cpuCores?: number;
    memoryUsedBytes?: bigint;
    memoryTotalBytes?: bigint;
    diskUsedBytes?: bigint;
    diskTotalBytes?: bigint;
    uptimeSeconds?: bigint;
    metadata?: Record<string, unknown>;
  }) {
    const externalId = ns(currentInstance.id, asset.externalId);
    const parentExternalId = asset.parentExternalId
      ? ns(currentInstance.id, asset.parentExternalId)
      : undefined;

    discoveredExternalIds.push(externalId);

    const existing = await prisma.infrastructureAsset.findUnique({
      where: {
        organizationId_provider_externalId: {
          organizationId: params.organizationId,
          provider: "PROXMOX",
          externalId,
        },
      },
    });

    await prisma.infrastructureAsset.upsert({
      where: {
        organizationId_provider_externalId: {
          organizationId: params.organizationId,
          provider: "PROXMOX",
          externalId,
        },
      },
      update: {
        assetType: asset.assetType,
        name: asset.name,
        status: asset.status,
        nodeName: asset.nodeName,
        parentExternalId,
        cpuPercent: asset.cpuPercent,
        cpuCores: asset.cpuCores,
        memoryUsedBytes: asset.memoryUsedBytes,
        memoryTotalBytes: asset.memoryTotalBytes,
        diskUsedBytes: asset.diskUsedBytes,
        diskTotalBytes: asset.diskTotalBytes,
        uptimeSeconds: asset.uptimeSeconds,
        metadata: j({
          ...(asset.metadata ?? {}),
          proxmoxInstanceId: currentInstance.id,
          proxmoxInstanceName: currentInstance.name,
          proxmoxSite: currentInstance.site,
          sourceExternalId: asset.externalId,
        }),
        active: true,
        lastSeenAt: now,
        lastChangedAt: now,
      },
      create: {
        organizationId: params.organizationId,
        provider: "PROXMOX",
        externalId,
        assetType: asset.assetType,
        name: asset.name,
        status: asset.status,
        nodeName: asset.nodeName,
        parentExternalId,
        cpuPercent: asset.cpuPercent,
        cpuCores: asset.cpuCores,
        memoryUsedBytes: asset.memoryUsedBytes,
        memoryTotalBytes: asset.memoryTotalBytes,
        diskUsedBytes: asset.diskUsedBytes,
        diskTotalBytes: asset.diskTotalBytes,
        uptimeSeconds: asset.uptimeSeconds,
        metadata: j({
          ...(asset.metadata ?? {}),
          proxmoxInstanceId: currentInstance.id,
          proxmoxInstanceName: currentInstance.name,
          proxmoxSite: currentInstance.site,
          sourceExternalId: asset.externalId,
        }),
        active: true,
        lastSeenAt: now,
        lastChangedAt: now,
      },
    });

    if (existing) updatedCount += 1;
    else createdCount += 1;
  }

  for (const node of nodes) {
    await save({
      externalId: `node/${node.node}`,
      assetType: "NODE",
      name: node.node,
      status: (node.status ?? "unknown").toUpperCase(),
      nodeName: node.node,
      cpuPercent: typeof node.cpu === "number" ? Math.round(node.cpu * 10000) / 100 : undefined,
      cpuCores: typeof node.maxcpu === "number" ? Math.trunc(node.maxcpu) : undefined,
      memoryUsedBytes: typeof node.mem === "number" ? BigInt(Math.trunc(node.mem)) : undefined,
      memoryTotalBytes: typeof node.maxmem === "number" ? BigInt(Math.trunc(node.maxmem)) : undefined,
      diskUsedBytes: typeof node.disk === "number" ? BigInt(Math.trunc(node.disk)) : undefined,
      diskTotalBytes: typeof node.maxdisk === "number" ? BigInt(Math.trunc(node.maxdisk)) : undefined,
      uptimeSeconds: typeof node.uptime === "number" ? BigInt(Math.trunc(node.uptime)) : undefined,
      metadata: { version },
    });
  }

  for (const guest of guests.filter((g) => (g.type === "qemu" || g.type === "lxc") && g.template !== 1)) {
    await save({
      externalId: `${guest.type}/${guest.vmid}`,
      assetType: guest.type === "qemu" ? "VM" : "LXC",
      name: guest.name ?? `${guest.type}-${guest.vmid}`,
      status: (guest.status ?? "unknown").toUpperCase(),
      nodeName: guest.node,
      parentExternalId: `node/${guest.node}`,
      cpuPercent: typeof guest.cpu === "number" ? Math.round(guest.cpu * 10000) / 100 : undefined,
      cpuCores: typeof guest.maxcpu === "number" ? Math.trunc(guest.maxcpu) : undefined,
      memoryUsedBytes: typeof guest.mem === "number" ? BigInt(Math.trunc(guest.mem)) : undefined,
      memoryTotalBytes: typeof guest.maxmem === "number" ? BigInt(Math.trunc(guest.maxmem)) : undefined,
      diskUsedBytes: typeof guest.disk === "number" ? BigInt(Math.trunc(guest.disk)) : undefined,
      diskTotalBytes: typeof guest.maxdisk === "number" ? BigInt(Math.trunc(guest.maxdisk)) : undefined,
      uptimeSeconds: typeof guest.uptime === "number" ? BigInt(Math.trunc(guest.uptime)) : undefined,
      metadata: { vmid: guest.vmid, guestType: guest.type, tags: guest.tags },
    });
  }

  for (const storage of storages) {
    const name = storage.storage ?? storage.id;
    await save({
      externalId: `storage/${storage.node ?? "cluster"}/${name}`,
      assetType: "STORAGE",
      name,
      status: (storage.status ?? "AVAILABLE").toUpperCase(),
      nodeName: storage.node,
      parentExternalId: storage.node ? `node/${storage.node}` : undefined,
      diskUsedBytes: typeof storage.disk === "number" ? BigInt(Math.trunc(storage.disk)) : undefined,
      diskTotalBytes: typeof storage.maxdisk === "number" ? BigInt(Math.trunc(storage.maxdisk)) : undefined,
      metadata: {
        storageType: storage.type,
        shared: storage.shared === 1,
        content: storage.content,
      },
    });
  }

  for (const node of nodes) {
    const interfaces = await client.network(node.node);
    for (const nic of interfaces) {
      if (!["bridge", "bond", "eth", "vlan", "OVSBridge", "OVSBond", "OVSPort", "OVSIntPort"].includes(nic.type ?? "")) {
        continue;
      }

      await save({
        externalId: `network/${node.node}/${nic.iface}`,
        assetType: "NETWORK",
        name: nic.iface,
        status: nic.active === 1 ? "ONLINE" : "OFFLINE",
        nodeName: node.node,
        parentExternalId: `node/${node.node}`,
        metadata: {
          interfaceType: nic.type,
          address: nic.address,
          cidr: nic.cidr,
          gateway: nic.gateway,
          bridgePorts: nic.bridge_ports,
          vlanAware: nic.bridge_vlan_aware === 1,
          bondSlaves: nic.bond_slaves,
          bondMode: nic.bond_mode,
        },
      });
    }
  }

  const prefix = `proxmox/${currentInstance.id}/`;

  await prisma.infrastructureAsset.updateMany({
    where: {
      organizationId: params.organizationId,
      provider: "PROXMOX",
      active: true,
      externalId: {
        startsWith: prefix,
        notIn: discoveredExternalIds,
      },
    },
    data: {
      active: false,
      status: "MISSING",
      lastChangedAt: new Date(),
    },
  });

  const verifiedCount = await prisma.infrastructureAsset.count({
    where: {
      organizationId: params.organizationId,
      provider: "PROXMOX",
      externalId: { in: discoveredExternalIds },
    },
  });

  await prisma.proxmoxInstance.update({
    where: { id: currentInstance.id },
    data: {
      status: "HEALTHY",
      lastHealthAt: new Date(),
      lastSyncAt: new Date(),
      lastError: null,
    },
  });

  return {
    instanceId: currentInstance.id,
    instanceName: currentInstance.name,
    endpoint: currentInstance.baseUrl,
    discovered: discoveredExternalIds.length,
    verifiedCount,
    createdCount,
    updatedCount,
    nodeCount: nodes.length,
    guestCount: guests.filter((g) => g.template !== 1).length,
    storageCount: storages.length,
  };
}
