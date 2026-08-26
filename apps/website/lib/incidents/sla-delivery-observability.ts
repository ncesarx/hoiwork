import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DeliveryStatus =
  | "PENDING"
  | "SENT"
  | "FAILED"
  | "SIMULATED"
  | "RETRY_PENDING"
  | string;

function jsonObject(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, Prisma.JsonValue>;
  }
  return value as Record<string, Prisma.JsonValue>;
}

function latencySeconds(createdAt: Date, sentAt: Date | null) {
  if (!sentAt) return null;
  return Math.max(
    0,
    Math.round(((sentAt.getTime() - createdAt.getTime()) / 1000) * 100) / 100,
  );
}

function average(values: number[]) {
  if (!values.length) return null;
  return (
    Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) /
    100
  );
}

export async function buildSlaDeliveryObservability(
  organizationId: string,
  take = 100,
) {
  const [escalations, deliveries] = await Promise.all([
    prisma.incidentSlaEscalation.findMany({
      where: { organizationId },
      include: { incident: true },
      orderBy: { detectedAt: "desc" },
      take,
    }),
    prisma.alertDelivery.findMany({
      where: {
        organizationId,
        payload: {
          path: ["type"],
          equals: "SLA_BREACH",
        },
      },
      include: {
        incident: true,
      },
      orderBy: { createdAt: "desc" },
      take: take * 5,
    }),
  ]);

  const deliveriesByEscalation = new Map<string, typeof deliveries>();

  for (const delivery of deliveries) {
    const payload = jsonObject(delivery.payload);
    const escalationId =
      typeof payload.escalationId === "string" ? payload.escalationId : null;

    if (!escalationId) continue;

    const bucket = deliveriesByEscalation.get(escalationId) ?? [];
    bucket.push(delivery);
    deliveriesByEscalation.set(escalationId, bucket);
  }

  const rows = escalations.map((escalation) => {
    const linked = deliveriesByEscalation.get(escalation.id) ?? [];

    const statuses = linked.reduce<Record<string, number>>((acc, delivery) => {
      acc[delivery.status] = (acc[delivery.status] ?? 0) + 1;
      return acc;
    }, {});

    const latencies = linked
      .map((delivery) => latencySeconds(delivery.createdAt, delivery.sentAt))
      .filter((value): value is number => value !== null);

    const lastDelivery = linked[0] ?? null;

    const failed = linked.filter(
      (delivery) =>
        delivery.status === "FAILED" ||
        Boolean(delivery.errorMessage),
    );

    return {
      escalationId: escalation.id,
      breachType: escalation.breachType,
      escalationStatus: escalation.status,
      severity: escalation.severity,
      detectedAt: escalation.detectedAt,
      clearedAt: escalation.clearedAt,
      incidentId: escalation.incidentId,
      title: escalation.incident.title,
      assetName: escalation.incident.assetName,
      site: escalation.incident.site,
      incidentStatus: escalation.incident.status,
      deliveriesTotal: linked.length,
      statuses,
      pending:
        (statuses.PENDING ?? 0) +
        (statuses.RETRY_PENDING ?? 0),
      sent: statuses.SENT ?? 0,
      simulated: statuses.SIMULATED ?? 0,
      failed: statuses.FAILED ?? 0,
      avgLatencySeconds: average(latencies),
      maxLatencySeconds: latencies.length ? Math.max(...latencies) : null,
      lastDeliveryAt: lastDelivery?.createdAt ?? null,
      lastSentAt: lastDelivery?.sentAt ?? null,
      lastStatus: (lastDelivery?.status ?? "NO_DELIVERY") as DeliveryStatus,
      lastError:
        failed[0]?.errorMessage ??
        lastDelivery?.errorMessage ??
        null,
      deliveries: linked.slice(0, 10).map((delivery) => ({
        id: delivery.id,
        channel: delivery.channel,
        recipient: delivery.recipient,
        status: delivery.status,
        attempt: delivery.attempt,
        createdAt: delivery.createdAt,
        sentAt: delivery.sentAt,
        errorMessage: delivery.errorMessage,
        latencySeconds: latencySeconds(
          delivery.createdAt,
          delivery.sentAt,
        ),
        policyName:
          typeof jsonObject(delivery.payload).policyName === "string"
            ? jsonObject(delivery.payload).policyName as string
            : null,
      })),
    };
  });

  const counters = {
    escalations: rows.length,
    openEscalations: rows.filter((row) => row.escalationStatus === "OPEN").length,
    deliveries: deliveries.length,
    pending: deliveries.filter((d) =>
      ["PENDING", "RETRY_PENDING"].includes(d.status),
    ).length,
    sent: deliveries.filter((d) => d.status === "SENT").length,
    simulated: deliveries.filter((d) => d.status === "SIMULATED").length,
    failed: deliveries.filter(
      (d) => d.status === "FAILED" || Boolean(d.errorMessage),
    ).length,
  };

  const allLatencies = deliveries
    .map((delivery) => latencySeconds(delivery.createdAt, delivery.sentAt))
    .filter((value): value is number => value !== null);

  const successDenominator =
    counters.sent + counters.failed;

  const deliverySuccessRate =
    successDenominator > 0
      ? Math.round((counters.sent / successDenominator) * 10000) / 100
      : null;

  const overall =
    counters.failed > 0
      ? "CRITICAL"
      : counters.pending > 0
        ? "DEGRADED"
        : counters.deliveries === 0
          ? "NO_DATA"
          : "HEALTHY";

  return {
    generatedAt: new Date(),
    overall,
    counters,
    metrics: {
      deliverySuccessRate,
      avgLatencySeconds: average(allLatencies),
      maxLatencySeconds: allLatencies.length
        ? Math.max(...allLatencies)
        : null,
    },
    rows,
  };
}
