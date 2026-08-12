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

function comparableFromExisting(existing: {
  name: string;
  status: string;
  cpuPercent: number | null;
  cpuCores: number | null;
  memoryUsedBytes: bigint | null;
  memoryTotalBytes: bigint | null;
  diskUsedBytes: bigint | null;
  diskTotalBytes: bigint | null;
  uptimeSeconds: bigint | null;
  version: string | null;
}) {
  return JSON.stringify({
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
  });
}

function comparableFromIncoming(node: NodeAssetInput) {
  return JSON.stringify({
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
}

export async function persistNodeAssets(params: {
  organizationId: string;
  integrationId: string;
  provider: string;
  nodes: NodeAssetInput[];
}) {
  if (!params.organizationId) {
    throw new Error("Persistence Audit: organizationId vazio.");
  }
  if (!params.integrationId) {
    throw new Error("Persistence Audit: integrationId vazio.");
  }
  if (!params.nodes.length) {
    throw new Error(
      "Persistence Audit: Discovery retornou zero nodes; persistência abortada.",
    );
  }

  console.log("[Persistence Audit] organizationId:", params.organizationId);
  console.log("[Persistence Audit] integrationId:", params.integrationId);
  console.log("[Persistence Audit] nodes recebidos:", params.nodes.length);

  const organization = await prisma.organization.findUnique({
    where: { id: params.organizationId },
    select: { id: true, name: true },
  });

  if (!organization) {
    throw new Error(
      `Persistence Audit: organização ${params.organizationId} não existe.`,
    );
  }

  const integration = await prisma.integration.findUnique({
    where: { id: params.integrationId },
    select: { id: true, organizationId: true, provider: true },
  });

  if (!integration) {
    throw new Error(
      `Persistence Audit: integração ${params.integrationId} não existe.`,
    );
  }

  if (integration.organizationId !== params.organizationId) {
    throw new Error(
      "Persistence Audit: integração pertence a outra organização.",
    );
  }

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  const persistedIds: string[] = [];

  for (const node of params.nodes) {
    console.log(
      `[Persistence Audit] persistindo ${node.externalId} (${node.name})`,
    );

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
    const changed =
      !existing ||
      comparableFromExisting(existing) !== comparableFromIncoming(node);

    const saved = await prisma.infrastructureAsset.upsert({
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
      select: { id: true, externalId: true, name: true },
    });

    persistedIds.push(saved.id);

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

  const verification = await prisma.infrastructureAsset.findMany({
    where: {
      organizationId: params.organizationId,
      provider: params.provider,
      assetType: "NODE",
      externalId: { in: activeExternalIds },
    },
    select: {
      id: true,
      externalId: true,
      name: true,
      status: true,
      active: true,
    },
    orderBy: { name: "asc" },
  });

  console.log(
    "[Persistence Audit] registros confirmados no banco:",
    verification.length,
  );

  if (verification.length !== params.nodes.length) {
    throw new Error(
      `Persistence Audit: esperado ${params.nodes.length} node(s), mas apenas ${verification.length} foram confirmados no PostgreSQL.`,
    );
  }

  return {
    createdCount,
    updatedCount,
    unchangedCount,
    offlineCount: markedOffline.count,
    verifiedCount: verification.length,
    persistedIds,
    verification,
  };
}
