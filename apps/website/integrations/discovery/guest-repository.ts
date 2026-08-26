import { prisma } from "@/lib/prisma";

export type GuestAssetInput = {
  externalId: string;
  assetType: "VM" | "LXC";
  name: string;
  nodeName: string;
  parentExternalId: string;
  status: string;
  cpuPercent?: number;
  cpuCores?: number;
  memoryUsedBytes?: bigint;
  memoryTotalBytes?: bigint;
  diskUsedBytes?: bigint;
  diskTotalBytes?: bigint;
  uptimeSeconds?: bigint;
  metadata?: Record<string, unknown>;
};

function json(value: Record<string, unknown> | undefined) {
  return value ? JSON.parse(JSON.stringify(value)) : undefined;
}

function comparableFromExisting(existing: any) {
  return JSON.stringify({
    name: existing.name,
    status: existing.status,
    nodeName: existing.nodeName,
    cpuPercent: existing.cpuPercent,
    cpuCores: existing.cpuCores,
    memoryUsedBytes: existing.memoryUsedBytes?.toString() ?? null,
    memoryTotalBytes: existing.memoryTotalBytes?.toString() ?? null,
    diskUsedBytes: existing.diskUsedBytes?.toString() ?? null,
    diskTotalBytes: existing.diskTotalBytes?.toString() ?? null,
    uptimeSeconds: existing.uptimeSeconds?.toString() ?? null,
  });
}

function comparableFromIncoming(guest: GuestAssetInput) {
  return JSON.stringify({
    name: guest.name,
    status: guest.status,
    nodeName: guest.nodeName,
    cpuPercent: guest.cpuPercent ?? null,
    cpuCores: guest.cpuCores ?? null,
    memoryUsedBytes: guest.memoryUsedBytes?.toString() ?? null,
    memoryTotalBytes: guest.memoryTotalBytes?.toString() ?? null,
    diskUsedBytes: guest.diskUsedBytes?.toString() ?? null,
    diskTotalBytes: guest.diskTotalBytes?.toString() ?? null,
    uptimeSeconds: guest.uptimeSeconds?.toString() ?? null,
  });
}

export async function persistGuestAssets(params: {
  organizationId: string;
  integrationId: string;
  guests: GuestAssetInput[];
}) {
  if (!params.guests.length) {
    return {
      createdCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      offlineCount: 0,
      verifiedCount: 0,
    };
  }

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  const externalIds = params.guests.map((g) => g.externalId);

  for (const guest of params.guests) {
    const existing = await prisma.infrastructureAsset.findUnique({
      where: {
        organizationId_provider_externalId: {
          organizationId: params.organizationId,
          provider: "PROXMOX",
          externalId: guest.externalId,
        },
      },
    });

    const changed =
      !existing ||
      comparableFromExisting(existing) !== comparableFromIncoming(guest);

    const now = new Date();

    await prisma.infrastructureAsset.upsert({
      where: {
        organizationId_provider_externalId: {
          organizationId: params.organizationId,
          provider: "PROXMOX",
          externalId: guest.externalId,
        },
      },
      update: {
        integrationId: params.integrationId,
        assetType: guest.assetType,
        name: guest.name,
        parentExternalId: guest.parentExternalId,
        nodeName: guest.nodeName,
        status: guest.status,
        cpuPercent: guest.cpuPercent,
        cpuCores: guest.cpuCores,
        memoryUsedBytes: guest.memoryUsedBytes,
        memoryTotalBytes: guest.memoryTotalBytes,
        diskUsedBytes: guest.diskUsedBytes,
        diskTotalBytes: guest.diskTotalBytes,
        uptimeSeconds: guest.uptimeSeconds,
        metadata: json(guest.metadata),
        active: true,
        lastSeenAt: now,
        lastChangedAt: changed ? now : existing?.lastChangedAt,
      },
      create: {
        organizationId: params.organizationId,
        integrationId: params.integrationId,
        provider: "PROXMOX",
        externalId: guest.externalId,
        assetType: guest.assetType,
        name: guest.name,
        parentExternalId: guest.parentExternalId,
        nodeName: guest.nodeName,
        status: guest.status,
        cpuPercent: guest.cpuPercent,
        cpuCores: guest.cpuCores,
        memoryUsedBytes: guest.memoryUsedBytes,
        memoryTotalBytes: guest.memoryTotalBytes,
        diskUsedBytes: guest.diskUsedBytes,
        diskTotalBytes: guest.diskTotalBytes,
        uptimeSeconds: guest.uptimeSeconds,
        metadata: json(guest.metadata),
        active: true,
        lastSeenAt: now,
        lastChangedAt: now,
      },
    });

    if (!existing) createdCount += 1;
    else if (changed) updatedCount += 1;
    else unchangedCount += 1;
  }

  const missing = await prisma.infrastructureAsset.updateMany({
    where: {
      organizationId: params.organizationId,
      provider: "PROXMOX",
      assetType: { in: ["VM", "LXC"] },
      active: true,
      externalId: { notIn: externalIds },
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
      assetType: { in: ["VM", "LXC"] },
      externalId: { in: externalIds },
    },
  });

  if (verifiedCount !== params.guests.length) {
    throw new Error(
      `Virtual Discovery: esperado ${params.guests.length} guest(s), mas ${verifiedCount} foram confirmados no PostgreSQL.`,
    );
  }

  return {
    createdCount,
    updatedCount,
    unchangedCount,
    offlineCount: missing.count,
    verifiedCount,
  };
}
