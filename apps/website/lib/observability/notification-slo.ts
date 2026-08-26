import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type HealthState = "HEALTHY" | "DEGRADED" | "CRITICAL" | "NO_DATA";

type DeliveryTelemetry = {
  transportLatencyMs?: number;
  queueGovernanceLatencyMs?: number;
  endToEndLatencyMs?: number;
};

function stateForSuccessRate(rate: number | null): HealthState {
  if (rate === null) return "NO_DATA";
  if (rate >= 99) return "HEALTHY";
  if (rate >= 95) return "DEGRADED";
  return "CRITICAL";
}

function stateForRetryRate(rate: number | null): HealthState {
  if (rate === null) return "NO_DATA";
  if (rate < 5) return "HEALTHY";
  if (rate < 15) return "DEGRADED";
  return "CRITICAL";
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function max(values: number[]) {
  if (!values.length) return null;
  return Math.max(...values);
}

function objectValue(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, Prisma.JsonValue>;
}

function numberValue(value: Prisma.JsonValue | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function telemetryOf(payload: Prisma.JsonValue | null): DeliveryTelemetry | null {
  const root = objectValue(payload);
  if (!root) return null;

  const telemetry = objectValue(root.telemetry ?? null);
  if (!telemetry) return null;

  return {
    transportLatencyMs:
      numberValue(telemetry.transportLatencyMs) ?? undefined,
    queueGovernanceLatencyMs:
      numberValue(telemetry.queueGovernanceLatencyMs) ?? undefined,
    endToEndLatencyMs:
      numberValue(telemetry.endToEndLatencyMs) ?? undefined,
  };
}

async function deliveryWindow(organizationId: string, since: Date) {
  const deliveries = await prisma.alertDelivery.findMany({
    where: {
      organizationId,
      createdAt: { gte: since },
      status: { in: ["SENT", "FAILED", "RETRY_PENDING"] },
    },
    orderBy: { createdAt: "asc" },
  });

  const sent = deliveries.filter((delivery) => delivery.status === "SENT");
  const failed = deliveries.filter((delivery) => delivery.status === "FAILED");
  const retry = deliveries.filter(
    (delivery) => delivery.status === "RETRY_PENDING",
  );

  const legacyEndToEnd = sent
    .map((delivery) =>
      delivery.sentAt
        ? Math.max(
            0,
            delivery.sentAt.getTime() - delivery.createdAt.getTime(),
          )
        : null,
    )
    .filter((value): value is number => value !== null);

  const telemetry = sent
    .map((delivery) => telemetryOf(delivery.payload))
    .filter((value): value is DeliveryTelemetry => value !== null);

  const transportLatencies = telemetry
    .map((item) => item.transportLatencyMs ?? null)
    .filter((value): value is number => value !== null);

  const queueLatencies = telemetry
    .map((item) => item.queueGovernanceLatencyMs ?? null)
    .filter((value): value is number => value !== null);

  const telemetryEndToEnd = telemetry
    .map((item) => item.endToEndLatencyMs ?? null)
    .filter((value): value is number => value !== null);

  const successRate = pct(sent.length, sent.length + failed.length);
  const failureRate = pct(failed.length, sent.length + failed.length);
  const retryRate = pct(retry.length, deliveries.length);

  return {
    totalLive: deliveries.length,
    sent: sent.length,
    failed: failed.length,
    retry: retry.length,
    successRate,
    failureRate,
    retryRate,
    successState: stateForSuccessRate(successRate),
    retryState: stateForRetryRate(retryRate),

    latency: {
      legacyEndToEndAvgMs: average(legacyEndToEnd),
      legacyEndToEndMaxMs: max(legacyEndToEnd),

      measuredDeliveries: telemetry.length,
      transportAvgMs: average(transportLatencies),
      transportMaxMs: max(transportLatencies),
      queueGovernanceAvgMs: average(queueLatencies),
      queueGovernanceMaxMs: max(queueLatencies),
      endToEndAvgMs: average(telemetryEndToEnd),
      endToEndMaxMs: max(telemetryEndToEnd),
    },
  };
}

async function automationWindow(organizationId: string, since: Date) {
  const runs = await prisma.notificationAutomationRun.findMany({
    where: {
      organizationId,
      startedAt: { gte: since },
    },
    orderBy: { startedAt: "desc" },
  });

  const completed = runs.filter((run) => run.status === "COMPLETED");
  const failed = runs.filter((run) => run.status === "FAILED");
  const successRate = pct(completed.length, completed.length + failed.length);

  const durations = completed
    .map((run) => run.durationMs)
    .filter((value): value is number => value !== null);

  const state: HealthState =
    failed.length > 0
      ? "CRITICAL"
      : successRate === null
        ? "NO_DATA"
        : successRate >= 99
          ? "HEALTHY"
          : successRate >= 95
            ? "DEGRADED"
            : "CRITICAL";

  return {
    runs: runs.length,
    completed: completed.length,
    failed: failed.length,
    successRate,
    avgDurationMs: average(durations),
    lastRunAt: runs[0]?.startedAt ?? null,
    lastSuccessAt: completed[0]?.finishedAt ?? null,
    state,
  };
}

async function connectorHealth(organizationId: string) {
  const connectors = await prisma.notificationConnector.findMany({
    where: {
      organizationId,
      enabled: true,
    },
    orderBy: { name: "asc" },
  });

  return connectors.map((connector) => {
    let score = 100;

    if (connector.mode !== "LIVE") score -= 25;
    if (connector.lastTestStatus !== "HEALTHY") score -= 40;
    if (connector.lastError) score -= 20;
    if (!connector.lastTestAt) score -= 15;

    score = Math.max(0, Math.min(100, score));

    const state: HealthState =
      score >= 90
        ? "HEALTHY"
        : score >= 70
          ? "DEGRADED"
          : "CRITICAL";

    return {
      id: connector.id,
      name: connector.name,
      type: connector.type,
      mode: connector.mode,
      lastTestStatus: connector.lastTestStatus,
      lastTestAt: connector.lastTestAt,
      lastError: connector.lastError,
      score,
      state,
    };
  });
}

export async function buildNotificationObservability(
  organizationId: string,
) {
  const now = new Date();
  const hour1 = new Date(now.getTime() - 60 * 60 * 1000);
  const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    delivery1h,
    delivery24h,
    delivery7d,
    automation1h,
    automation24h,
    automation7d,
    connectors,
    lastSent,
  ] = await Promise.all([
    deliveryWindow(organizationId, hour1),
    deliveryWindow(organizationId, day1),
    deliveryWindow(organizationId, day7),
    automationWindow(organizationId, hour1),
    automationWindow(organizationId, day1),
    automationWindow(organizationId, day7),
    connectorHealth(organizationId),
    prisma.alertDelivery.findFirst({
      where: {
        organizationId,
        status: "SENT",
      },
      orderBy: { sentAt: "desc" },
    }),
  ]);

  const connectorAverage = connectors.length
    ? Math.round(
        connectors.reduce((sum, connector) => sum + connector.score, 0) /
          connectors.length,
      )
    : null;

  const overall: HealthState =
    delivery24h.successState === "CRITICAL" ||
    delivery24h.retryState === "CRITICAL" ||
    automation24h.state === "CRITICAL" ||
    connectors.some((connector) => connector.state === "CRITICAL")
      ? "CRITICAL"
      : delivery24h.successState === "DEGRADED" ||
          delivery24h.retryState === "DEGRADED" ||
          automation24h.state === "DEGRADED" ||
          connectors.some((connector) => connector.state === "DEGRADED")
        ? "DEGRADED"
        : delivery24h.successState === "NO_DATA" &&
            automation24h.state === "NO_DATA"
          ? "NO_DATA"
          : "HEALTHY";

  return {
    generatedAt: now,
    telemetryVersion: "015.6.10.1b",
    slo: {
      deliverySuccessTarget: 99,
      retryRateTargetMax: 5,
      automationFailureTarget: 0,
    },
    overall,
    delivery: {
      h1: delivery1h,
      h24: delivery24h,
      d7: delivery7d,
      lastSuccessfulDeliveryAt: lastSent?.sentAt ?? null,
    },
    automation: {
      h1: automation1h,
      h24: automation24h,
      d7: automation7d,
    },
    connectors: {
      averageScore: connectorAverage,
      items: connectors,
    },
  };
}
