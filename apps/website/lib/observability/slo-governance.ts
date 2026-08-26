import { prisma } from "@/lib/prisma";
import { runSloRetention } from "@/lib/observability/slo-reporting";

export async function getRetentionGovernance(organizationId: string) {
  const config = await prisma.notificationSloRetentionConfig.upsert({
    where: { organizationId },
    update: {},
    create: {
      organizationId,
      enabled: true,
      retentionDays: 90,
    },
  });

  const [totalSnapshots, oldest, newest] = await Promise.all([
    prisma.notificationSloSnapshot.count({
      where: { organizationId },
    }),
    prisma.notificationSloSnapshot.findFirst({
      where: { organizationId },
      orderBy: { capturedAt: "asc" },
      select: { capturedAt: true },
    }),
    prisma.notificationSloSnapshot.findFirst({
      where: { organizationId },
      orderBy: { capturedAt: "desc" },
      select: { capturedAt: true },
    }),
  ]);

  return {
    config,
    totalSnapshots,
    oldestSnapshotAt: oldest?.capturedAt ?? null,
    newestSnapshotAt: newest?.capturedAt ?? null,
  };
}

export async function runRetentionIfDue(organizationId: string) {
  const config = await prisma.notificationSloRetentionConfig.upsert({
    where: { organizationId },
    update: {},
    create: {
      organizationId,
      enabled: true,
      retentionDays: 90,
    },
  });

  if (!config.enabled) {
    return {
      skipped: true,
      reason: "RETENTION_DISABLED",
      deleted: 0,
    };
  }

  const due =
    !config.lastCleanupAt ||
    Date.now() - config.lastCleanupAt.getTime() >= 24 * 60 * 60 * 1000;

  if (!due) {
    return {
      skipped: true,
      reason: "RETENTION_NOT_DUE",
      deleted: 0,
    };
  }

  return runSloRetention(organizationId);
}
