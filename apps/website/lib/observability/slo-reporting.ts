import { prisma } from "@/lib/prisma";

function avg(values: Array<number | null>) {
  const valid = values.filter((v): v is number => v !== null);
  if (!valid.length) return null;
  return Math.round((valid.reduce((a,b)=>a+b,0)/valid.length)*100)/100;
}

function min(values: Array<number | null>) {
  const valid = values.filter((v): v is number => v !== null);
  return valid.length ? Math.min(...valid) : null;
}

function max(values: Array<number | null>) {
  const valid = values.filter((v): v is number => v !== null);
  return valid.length ? Math.max(...valid) : null;
}

export async function buildSloReport(organizationId: string, days = 30) {
  const safeDays = Math.max(1, Math.min(365, Math.trunc(days)));
  const since = new Date(Date.now() - safeDays * 86400000);

  const snapshots = await prisma.notificationSloSnapshot.findMany({
    where: { organizationId, capturedAt: { gte: since } },
    orderBy: { capturedAt: "asc" },
  });

  const healthy = snapshots.filter(s => s.overallState === "HEALTHY").length;
  const degraded = snapshots.filter(s => s.overallState === "DEGRADED").length;
  const critical = snapshots.filter(s => s.overallState === "CRITICAL").length;

  return {
    periodDays: safeDays,
    since,
    generatedAt: new Date(),
    samples: snapshots.length,
    stateDistribution: { healthy, degraded, critical },
    metrics: {
      nocHealth: {
        avg: avg(snapshots.map(s=>s.nocHealthScore)),
        min: min(snapshots.map(s=>s.nocHealthScore)),
        max: max(snapshots.map(s=>s.nocHealthScore)),
      },
      deliverySuccess24h: {
        avg: avg(snapshots.map(s=>s.deliverySuccess24h)),
        min: min(snapshots.map(s=>s.deliverySuccess24h)),
      },
      errorBudget24h: {
        avg: avg(snapshots.map(s=>s.errorBudget24h)),
        min: min(snapshots.map(s=>s.errorBudget24h)),
      },
      burnRate1h: {
        avg: avg(snapshots.map(s=>s.burnRate1h)),
        max: max(snapshots.map(s=>s.burnRate1h)),
      },
    },
    series: snapshots.map(s => ({
      capturedAt: s.capturedAt,
      state: s.overallState,
      nocHealthScore: s.nocHealthScore,
      deliverySuccess24h: s.deliverySuccess24h,
      errorBudget24h: s.errorBudget24h,
      burnRate1h: s.burnRate1h,
      retryRate24h: s.retryRate24h,
    })),
  };
}

export async function runSloRetention(organizationId: string) {
  const config = await prisma.notificationSloRetentionConfig.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId, enabled: true, retentionDays: 90 },
  });

  if (!config.enabled) return { skipped: true, reason: "RETENTION_DISABLED", deleted: 0 };

  const cutoff = new Date(Date.now() - config.retentionDays * 86400000);
  const result = await prisma.notificationSloSnapshot.deleteMany({
    where: { organizationId, capturedAt: { lt: cutoff } },
  });

  await prisma.notificationSloRetentionConfig.update({
    where: { organizationId },
    data: { lastCleanupAt: new Date(), lastDeletedCount: result.count },
  });

  return { skipped: false, cutoff, deleted: result.count, retentionDays: config.retentionDays };
}
