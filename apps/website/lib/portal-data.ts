import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/authz";
import { DEMO_ASSET_IDS } from "@/lib/inventory/demo-assets";
import { buildProxmoxInventory } from "@/lib/inventory/proxmox-topology";
import { collectionFreshness } from "@/lib/inventory/freshness";

export const getDashboardData = cache(async () => {
  const { organization } = await requireOrganization();
  const organizationId = organization.id;

  const [instances, discovered, registered, openTickets, documentCount, contractCount, tickets, contracts] =
    await Promise.all([
      prisma.proxmoxInstance.findMany({
        where: { organizationId, enabled: true },
        select: { id: true, name: true, site: true, baseUrl: true, status: true, lastSyncAt: true, lastError: true },
      }),
      prisma.infrastructureAsset.findMany({
        where: {
          organizationId,
          provider: "PROXMOX",
          active: true,
          externalId: { startsWith: "proxmox/" },
        },
        select: {
          externalId: true, clusterName: true, assetType: true, name: true, nodeName: true,
          status: true, ipAddress: true, metadata: true, lastSeenAt: true,
        },
      }),
      prisma.asset.findMany({
        where: { organizationId, id: { notIn: DEMO_ASSET_IDS } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.ticket.count({ where: { organizationId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      prisma.document.count({ where: { organizationId } }),
      prisma.contract.count({ where: { organizationId, status: "ACTIVE" } }),
      prisma.ticket.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" }, take: 5 }),
      prisma.contract.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { endsAt: "asc" }, take: 3 }),
    ]);

  const resources = buildProxmoxInventory(instances, discovered).flatMap((cluster) => [
    ...cluster.nodes.flatMap((node) => [
      node.resource, ...node.guests, ...node.storages, ...node.networks,
    ]),
    ...cluster.clusterStorages,
    ...cluster.unassignedResources,
  ]);
  const evaluatedAt = new Date();
  const assets = [
    ...resources.map((resource) => ({
      id: resource.key, name: resource.name, type: resource.type,
      status: resource.status, ipAddress: resource.ipAddress,
      source: "Proxmox", observedAt: resource.lastSeenAt,
      freshness: collectionFreshness(resource.lastSeenAt, evaluatedAt),
    })),
    ...registered.map((asset) => ({
      id: asset.id, name: asset.name, type: asset.type,
      status: asset.status, ipAddress: asset.ipAddress,
      source: "Cadastro", observedAt: null, freshness: null,
    })),
  ];
  return {
    organization, assetCount: assets.length,
    nodeCount: resources.filter((resource) => resource.type === "NODE").length,
    proxmoxEndpoints: instances.map((instance) => ({
      id: instance.id,
      name: instance.name,
      status: instance.status,
      lastAttemptFailed: !!instance.lastError,
      lastSyncAt: instance.lastSyncAt,
      freshness: collectionFreshness(instance.lastSyncAt, evaluatedAt),
    })),
    openTickets,
    documentCount, contractCount, assets: assets.slice(0, 6), tickets, contracts,
  };
});

export const getAssets = cache(async (query?: string, type?: string) => {
  const { organization } = await requireOrganization();
  return prisma.asset.findMany({
    where: {
      organizationId: organization.id,
      ...(type && type !== "ALL" ? { type } : {}),
      ...(query ? { OR: [
        { name: { contains: query, mode: "insensitive" } },
        { manufacturer: { contains: query, mode: "insensitive" } },
        { model: { contains: query, mode: "insensitive" } },
        { serialNumber: { contains: query, mode: "insensitive" } },
        { ipAddress: { contains: query, mode: "insensitive" } },
      ] } : {}),
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
});

export const getTickets = cache(async (status?: string) => {
  const { organization } = await requireOrganization();
  return prisma.ticket.findMany({
    where: {
      organizationId: organization.id,
      ...(status && status !== "ALL" ? { status: status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" } : {}),
    },
    include: { openedBy: { select: { name: true, email: true } } },
    orderBy: { updatedAt: "desc" },
  });
});

export const getContracts = cache(async () => {
  const { organization } = await requireOrganization();
  return prisma.contract.findMany({ where: { organizationId: organization.id }, orderBy: { endsAt: "asc" } });
});

export const getBackupJobs = cache(async () => {
  const { organization } = await requireOrganization();
  return prisma.backupJob.findMany({ where: { organizationId: organization.id }, orderBy: { name: "asc" } });
});

export const getDrPlan = cache(async () => {
  const { organization } = await requireOrganization();
  return prisma.disasterRecoveryPlan.findUnique({ where: { organizationId: organization.id } });
});
