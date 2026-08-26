import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildNocHealthModel } from "@/lib/observability/noc-health";

function delta(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  return Math.round((current - previous) * 100) / 100;
}

export async function captureSloSnapshot(organizationId: string) {
  const model = await buildNocHealthModel(organizationId);

  const metadata: Prisma.InputJsonValue = {
    telemetryVersion: "015.6.10.3",
    sourceOverall: model.source.overall,
    deliverySuccessTarget: model.source.slo.deliverySuccessTarget,
    retryRateTargetMax: model.source.slo.retryRateTargetMax,
  };

  return prisma.notificationSloSnapshot.create({
    data: {
      organizationId,
      overallState: model.state,
      nocHealthScore: model.nocHealthScore,
      burnState: model.burnState,
      deliverySuccess1h: model.windows.h1.successRate,
      deliverySuccess24h: model.windows.h24.successRate,
      deliverySuccess7d: model.windows.d7.successRate,
      retryRate1h: model.source.delivery.h1.retryRate,
      retryRate24h: model.source.delivery.h24.retryRate,
      retryRate7d: model.source.delivery.d7.retryRate,
      errorBudget1h: model.windows.h1.errorBudgetRemaining,
      errorBudget24h: model.windows.h24.errorBudgetRemaining,
      errorBudget7d: model.windows.d7.errorBudgetRemaining,
      burnRate1h: model.windows.h1.burnRate,
      burnRate24h: model.windows.h24.burnRate,
      burnRate7d: model.windows.d7.burnRate,
      connectorScore: model.components.connectorScore,
      automationSuccess24h: model.source.automation.h24.successRate,
      metadata,
    },
  });
}

export async function getSloTrend(organizationId: string) {
  const snapshots = await prisma.notificationSloSnapshot.findMany({
    where: { organizationId },
    orderBy: { capturedAt: "desc" },
    take: 120,
  });

  const current = snapshots[0] ?? null;
  const previous = snapshots[1] ?? null;

  const chronological = [...snapshots].reverse();

  return {
    current,
    previous,
    deltas: {
      nocHealthScore: delta(current?.nocHealthScore ?? null, previous?.nocHealthScore ?? null),
      deliverySuccess24h: delta(current?.deliverySuccess24h ?? null, previous?.deliverySuccess24h ?? null),
      errorBudget24h: delta(current?.errorBudget24h ?? null, previous?.errorBudget24h ?? null),
      burnRate1h: delta(current?.burnRate1h ?? null, previous?.burnRate1h ?? null),
      connectorScore: delta(current?.connectorScore ?? null, previous?.connectorScore ?? null),
    },
    series: chronological.map((item) => ({
      id: item.id,
      capturedAt: item.capturedAt,
      overallState: item.overallState,
      nocHealthScore: item.nocHealthScore,
      deliverySuccess24h: item.deliverySuccess24h,
      retryRate24h: item.retryRate24h,
      errorBudget24h: item.errorBudget24h,
      burnRate1h: item.burnRate1h,
      connectorScore: item.connectorScore,
      automationSuccess24h: item.automationSuccess24h,
    })),
  };
}
