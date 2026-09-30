import { prisma } from "@/lib/prisma";

export async function recordProxmoxDiscoveryFailure(input: {
  organizationId: string;
  instanceId: string;
  startedAt: Date;
  message: string;
}) {
  return prisma.proxmoxInstance.updateMany({
    where: {
      id: input.instanceId,
      organizationId: input.organizationId,
      enabled: true,
      OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: input.startedAt } }],
    },
    data: { status: "ERROR", lastHealthAt: new Date(), lastError: input.message },
  });
}
