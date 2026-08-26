import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { captureSloSnapshot } from "@/lib/observability/slo-snapshots";
import { buildNocHealthModel } from "@/lib/observability/noc-health";
import { runRetentionIfDue } from "@/lib/observability/slo-governance";

type TrendAlertCandidate = {
  alertKey: string;
  alertType: string;
  severity: "DEGRADED" | "CRITICAL";
  title: string;
  message: string;
  metric: string;
  currentValue: number | null;
  threshold: number | null;
};

async function acquireLock(organizationId: string) {
  const key = `hoiwork:slo-automation:${organizationId}`;
  const rows = await prisma.$queryRaw<Array<{ acquired: boolean }>>(
    Prisma.sql`SELECT pg_try_advisory_lock(hashtext(${key})) AS acquired`,
  );
  return { acquired: Boolean(rows[0]?.acquired), key };
}

async function releaseLock(key: string) {
  await prisma.$queryRaw(
    Prisma.sql`SELECT pg_advisory_unlock(hashtext(${key}))`,
  );
}

function candidatesFromModel(
  model: Awaited<ReturnType<typeof buildNocHealthModel>>,
  config: {
    nocDegradedBelow: number;
    nocCriticalBelow: number;
    burnDegradedAt: number;
    burnCriticalAt: number;
  },
): TrendAlertCandidate[] {
  const candidates: TrendAlertCandidate[] = [];

  const noc = model.nocHealthScore;
  if (noc !== null && noc < config.nocCriticalBelow) {
    candidates.push({
      alertKey: "NOC_HEALTH_CRITICAL",
      alertType: "NOC_HEALTH",
      severity: "CRITICAL",
      title: "NOC Health crítico",
      message: `NOC Health Score em ${noc}/100.`,
      metric: "nocHealthScore",
      currentValue: noc,
      threshold: config.nocCriticalBelow,
    });
  } else if (noc !== null && noc < config.nocDegradedBelow) {
    candidates.push({
      alertKey: "NOC_HEALTH_DEGRADED",
      alertType: "NOC_HEALTH",
      severity: "DEGRADED",
      title: "NOC Health degradado",
      message: `NOC Health Score em ${noc}/100.`,
      metric: "nocHealthScore",
      currentValue: noc,
      threshold: config.nocDegradedBelow,
    });
  }

  const burn = model.windows.h1.burnRate;
  if (burn !== null && burn >= config.burnCriticalAt) {
    candidates.push({
      alertKey: "BURN_RATE_CRITICAL",
      alertType: "BURN_RATE",
      severity: "CRITICAL",
      title: "Burn Rate crítico",
      message: `Burn Rate 1h em ${burn}x.`,
      metric: "burnRate1h",
      currentValue: burn,
      threshold: config.burnCriticalAt,
    });
  } else if (burn !== null && burn >= config.burnDegradedAt) {
    candidates.push({
      alertKey: "BURN_RATE_DEGRADED",
      alertType: "BURN_RATE",
      severity: "DEGRADED",
      title: "Burn Rate degradado",
      message: `Burn Rate 1h em ${burn}x.`,
      metric: "burnRate1h",
      currentValue: burn,
      threshold: config.burnDegradedAt,
    });
  }

  return candidates;
}

async function reconcileTrendAlerts(
  organizationId: string,
  candidates: TrendAlertCandidate[],
) {
  const now = new Date();
  const activeKeys = candidates.map((item) => item.alertKey);

  for (const item of candidates) {
    await prisma.notificationSloTrendAlert.upsert({
      where: {
        organizationId_alertKey: {
          organizationId,
          alertKey: item.alertKey,
        },
      },
      update: {
        alertType: item.alertType,
        severity: item.severity,
        status: "OPEN",
        title: item.title,
        message: item.message,
        metric: item.metric,
        currentValue: item.currentValue,
        threshold: item.threshold,
        lastSeenAt: now,
        resolvedAt: null,
        metadata: {
          source: "SLO_TREND_ENGINE",
          version: "015.6.10.6",
        },
      },
      create: {
        organizationId,
        alertKey: item.alertKey,
        alertType: item.alertType,
        severity: item.severity,
        status: "OPEN",
        title: item.title,
        message: item.message,
        metric: item.metric,
        currentValue: item.currentValue,
        threshold: item.threshold,
        firstSeenAt: now,
        lastSeenAt: now,
        metadata: {
          source: "SLO_TREND_ENGINE",
          version: "015.6.10.6",
        },
      },
    });
  }

  const resolved = await prisma.notificationSloTrendAlert.updateMany({
    where: {
      organizationId,
      status: "OPEN",
      ...(activeKeys.length ? { alertKey: { notIn: activeKeys } } : {}),
    },
    data: {
      status: "RESOLVED",
      resolvedAt: now,
      lastSeenAt: now,
    },
  });

  return { active: candidates.length, resolved: resolved.count };
}

export async function runSloAutomation(input: {
  organizationId: string;
  respectEnabled?: boolean;
}) {
  const config = await prisma.notificationSloAutomationConfig.upsert({
    where: { organizationId: input.organizationId },
    update: {},
    create: {
      organizationId: input.organizationId,
      enabled: false,
      intervalMinutes: 15,
    },
  });

  if (input.respectEnabled && !config.enabled) {
    return { skipped: true, reason: "SLO_AUTOMATION_DISABLED" };
  }

  const due =
    !config.lastRunAt ||
    Date.now() - config.lastRunAt.getTime() >= config.intervalMinutes * 60000;

  if (input.respectEnabled && !due) {
    return { skipped: true, reason: "INTERVAL_NOT_DUE" };
  }

  const lock = await acquireLock(input.organizationId);
  if (!lock.acquired) {
    return { skipped: true, reason: "CONCURRENT_RUN" };
  }

  try {
    const snapshot = await captureSloSnapshot(input.organizationId);
    const model = await buildNocHealthModel(input.organizationId);
    const candidates = candidatesFromModel(model, config);
    const alerts = await reconcileTrendAlerts(input.organizationId, candidates);
    const retention = await runRetentionIfDue(input.organizationId);

    const now = new Date();
    await prisma.notificationSloAutomationConfig.update({
      where: { organizationId: input.organizationId },
      data: {
        lastRunAt: now,
        lastSuccessAt: now,
        lastError: null,
      },
    });

    return {
      skipped: false,
      snapshotId: snapshot.id,
      capturedAt: snapshot.capturedAt,
      nocHealthScore: model.nocHealthScore,
      burnRate1h: model.windows.h1.burnRate,
      alerts,
      retention,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha na automação SLO.";

    await prisma.notificationSloAutomationConfig.update({
      where: { organizationId: input.organizationId },
      data: {
        lastRunAt: new Date(),
        lastError: message,
      },
    });

    throw error;
  } finally {
    await releaseLock(lock.key).catch(() => {});
  }
}
