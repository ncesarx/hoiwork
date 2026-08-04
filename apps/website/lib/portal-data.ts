import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/authz";

export const getDashboardData = cache(async () => {
  const { organization } = await requireOrganization();
  const organizationId = organization.id;

  const [assetCount, onlineAssets, openTickets, documentCount, contractCount, assets, tickets, contracts] =
    await Promise.all([
      prisma.asset.count({ where: { organizationId } }),
      prisma.asset.count({ where: { organizationId, status: "ONLINE" } }),
      prisma.ticket.count({ where: { organizationId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      prisma.document.count({ where: { organizationId } }),
      prisma.contract.count({ where: { organizationId, status: "ACTIVE" } }),
      prisma.asset.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" }, take: 6 }),
      prisma.ticket.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" }, take: 5 }),
      prisma.contract.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { endsAt: "asc" }, take: 3 }),
    ]);

  return { organization, assetCount, onlineAssets, openTickets, documentCount, contractCount, assets, tickets, contracts };
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
