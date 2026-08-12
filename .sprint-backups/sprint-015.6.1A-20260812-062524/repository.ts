import { prisma } from "@/lib/prisma";

export type NodeAssetInput = {
  externalId: string;
  name: string;
  clusterName?: string;
  status: string;
  cpuPercent?: number;
  cpuCores?: number;
  memoryUsedBytes?: bigint;
  memoryTotalBytes?: bigint;
  diskUsedBytes?: bigint;
  diskTotalBytes?: bigint;
  uptimeSeconds?: bigint;
  version?: string;
  metadata?: Record<string, unknown>;
};

function json(value: Record<string, unknown> | undefined) {
  return value ? JSON.parse(JSON.stringify(value)) : undefined;
}

export async function persistNodeAssets(params: {
  organizationId: string;
  integrationId: string;
  provider: string;
  nodes: NodeAssetInput[];
}) {
  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const node of params.nodes) {
    const existing = await prisma.infrastructureAsset.findUnique({
      where: {
        organizationId_provider_externalId: {
          organizationId: params.organizationId,
          provider: params.provider,
          externalId: node.externalId,
        },
      },
    });

    const now = new Date();

    const comparable = existing
      ? JSON.stringify({
          name: existing.name,
          status: existing.status,
          cpuPercent: existing.cpuPercent,
          cpuCores: existing.cpuCores,
          memoryUsedBytes: existing.memoryUsedBytes?.toString() ?? null,
          memoryTotalBytes: existing.memoryTotalBytes?.toString() ?? null,
          diskUsedBytes: existing.diskUsedBytes?.toString() ?? null,
          diskTotalBytes: existing.diskTotalBytes?.toString() ?? null,
          uptimeSeconds: existing.uptimeSeconds?.toString() ?? null,
          version: existing.version,
        })
      : null;

    const incoming = JSON.stringify({
      name: node.name,
      status: node.status,
      cpuPercent: node.cpuPercent ?? null,
      cpuCores: node.cpuCores ?? null,
      memoryUsedBytes: node.memoryUsedBytes?.toString() ?? null,
      memoryTotalBytes: node.memoryTotalBytes?.toString() ?? null,
      diskUsedBytes: node.diskUsedBytes?.toString() ?? null,
      diskTotalBytes: node.diskTotalBytes?.toString() ?? null,
      uptimeSeconds: node.uptimeSeconds?.toString() ?? null,
      version: node.version ?? null,
    });

    const changed = comparable !== incoming;

    await prisma.infrastructureAsset.upsert({
      where: {
        organizationId_provider_externalId: {
          organizationId: params.organizationId,
          provider: params.provider,
          externalId: node.externalId,
        },
      },
      update: {
        integrationId: params.integrationId,
        assetType: "NODE",
        name: node.name,
        clusterName: node.clusterName,
        nodeName: node.name,
        status: node.status,
        cpuPercent: node.cpuPercent,
        cpuCores: node.cpuCores,
        memoryUsedBytes: node.memoryUsedBytes,
        memoryTotalBytes: node.memoryTotalBytes,
        diskUsedBytes: node.diskUsedBytes,
        diskTotalBytes: node.diskTotalBytes,
        uptimeSeconds: node.uptimeSeconds,
        version: node.version,
        metadata: json(node.metadata),
        lastSeenAt: now,
        lastChangedAt: changed ? now : existing?.lastChangedAt,
        active: true,
      },
      create: {
        organizationId: params.organizationId,
        integrationId: params.integrationId,
        externalId: node.externalId,
        provider: params.provider,
        assetType: "NODE",
        name: node.name,
        clusterName: node.clusterName,
        nodeName: node.name,
        status: node.status,
        cpuPercent: node.cpuPercent,
        cpuCores: node.cpuCores,
        memoryUsedBytes: node.memoryUsedBytes,
        memoryTotalBytes: node.memoryTotalBytes,
        diskUsedBytes: node.diskUsedBytes,
        diskTotalBytes: node.diskTotalBytes,
        uptimeSeconds: node.uptimeSeconds,
        version: node.version,
        metadata: json(node.metadata),
        lastSeenAt: now,
        lastChangedAt: now,
        active: true,
      },
    });

    if (!existing) createdCount += 1;
    else if (changed) updatedCount += 1;
    else unchangedCount += 1;
  }

  const activeExternalIds = params.nodes.map((node) => node.externalId);

  const markedOffline = await prisma.infrastructureAsset.updateMany({
    where: {
      organizationId: params.organizationId,
      provider: params.provider,
      assetType: "NODE",
      active: true,
      externalId: { notIn: activeExternalIds },
    },
    data: {
      active: false,
      status: "MISSING",
      lastChangedAt: new Date(),
    },
  });

  return {
    createdCount,
    updatedCount,
    unchangedCount,
    offlineCount: markedOffline.count,
  };
}
