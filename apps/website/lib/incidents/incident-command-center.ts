import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type RecommendedAction =
  | "ASSIGN_OWNER"
  | "ACKNOWLEDGE"
  | "INVESTIGATE_AND_UPDATE"
  | "WAIT_FOR_RECOVERY_EVIDENCE"
  | "READY_FOR_RESOLUTION"
  | "MONITOR"
  | "CLOSED";

function objectJson(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, Prisma.JsonValue>;
  }
  return value as Record<string, Prisma.JsonValue>;
}

function minutesBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60000));
}

function formatRecommendation(input: {
  status: string;
  assignedToName: string | null;
  acknowledgedAt: Date | null;
  openSlaBreaches: number;
  recoveryEvidence: number;
}): { action: RecommendedAction; label: string; reason: string; priority: number } {
  if (input.status === "RESOLVED") {
    return {
      action: "CLOSED",
      label: "Incidente encerrado",
      reason: "O lifecycle já está em RESOLVED.",
      priority: 0,
    };
  }

  if (!input.assignedToName) {
    return {
      action: "ASSIGN_OWNER",
      label: "Atribuir responsável",
      reason: "O incidente ainda não possui ownership operacional.",
      priority: 100,
    };
  }

  if (!input.acknowledgedAt) {
    return {
      action: "ACKNOWLEDGE",
      label: "Reconhecer incidente",
      reason: "O incidente possui responsável, mas ainda não recebeu ACK nativo.",
      priority: 95,
    };
  }

  if (input.openSlaBreaches > 0) {
    return {
      action: "INVESTIGATE_AND_UPDATE",
      label: "Investigar e atualizar",
      reason: "Existe breach de SLA ativo e o incidente exige acompanhamento operacional.",
      priority: 90,
    };
  }

  if (input.recoveryEvidence >= 2) {
    return {
      action: "READY_FOR_RESOLUTION",
      label: "Validar resolução",
      reason: "Há evidência de recuperação suficiente para encerramento controlado.",
      priority: 75,
    };
  }

  if (input.recoveryEvidence === 1) {
    return {
      action: "WAIT_FOR_RECOVERY_EVIDENCE",
      label: "Aguardar nova evidência",
      reason: "Há uma evidência de recuperação; aguarde confirmação adicional para evitar flapping.",
      priority: 50,
    };
  }

  return {
    action: "MONITOR",
    label: "Monitorar incidente",
    reason: "Incidente reconhecido, sem breach ativo e sem evidência suficiente de recuperação.",
    priority: 30,
  };
}

function numericEvidence(metadata: Prisma.JsonValue | null) {
  const object = objectJson(metadata);
  const keys = [
    "recoveryEvidenceCount",
    "recoveryEvidence",
    "evidenceCount",
    "evidence",
  ];

  for (const key of keys) {
    const value = object[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.trunc(value));
    }
  }

  return 0;
}

export async function buildIncidentCommandCenter(
  organizationId: string,
  incidentId: string,
) {
  const incident = await prisma.infrastructureIncident.findFirst({
    where: { id: incidentId, organizationId },
    include: {
      events: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      slaEscalations: { orderBy: { detectedAt: "desc" } },
      alertDeliveries: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });

  if (!incident) return null;

  const asset = await prisma.infrastructureAsset.findFirst({
    where: {
      organizationId,
      externalId: incident.assetExternalId,
    },
    orderBy: { lastSeenAt: "desc" },
  });

  const openSla = incident.slaEscalations.filter((item) => item.status === "OPEN");

  const eventEvidence = incident.events.reduce(
    (max, event) => Math.max(max, numericEvidence(event.metadata)),
    0,
  );
  const incidentEvidence = numericEvidence(incident.metadata);
  const recoveryEvidence = Math.max(eventEvidence, incidentEvidence);

  const statusCounts = incident.alertDeliveries.reduce<Record<string, number>>(
    (acc, delivery) => {
      acc[delivery.status] = (acc[delivery.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const deliveryFailed = incident.alertDeliveries.filter(
    (delivery) => delivery.status === "FAILED" || Boolean(delivery.errorMessage),
  ).length;
  const deliveryPending =
    (statusCounts.PENDING ?? 0) + (statusCounts.RETRY_PENDING ?? 0);
  const deliverySent = statusCounts.SENT ?? 0;
  const deliverySimulated = statusCounts.SIMULATED ?? 0;

  const deliveryHealth =
    deliveryFailed > 0
      ? "CRITICAL"
      : deliveryPending > 0
        ? "DEGRADED"
        : incident.alertDeliveries.length === 0
          ? "NO_DATA"
          : "HEALTHY";

  const currentTime = new Date();
  const ageMinutes = minutesBetween(
    incident.createdAt,
    incident.resolvedAt ?? currentTime,
  );

  const recommendation = formatRecommendation({
    status: incident.status,
    assignedToName: incident.assignedToName,
    acknowledgedAt: incident.acknowledgedAt,
    openSlaBreaches: openSla.length,
    recoveryEvidence,
  });

  const timeline = [
    ...incident.events.map((event) => ({
      id: `event-${event.id}`,
      type: event.eventType,
      message: event.message,
      actor: event.actorName,
      at: event.createdAt,
    })),
    ...incident.notes.map((note) => ({
      id: `note-${note.id}`,
      type: "NOTE",
      message: note.body,
      actor: note.authorName,
      at: note.createdAt,
    })),
    {
      id: "detected",
      type: "DETECTED",
      message: "Incidente detectado pela correlação de infraestrutura.",
      actor: "HOIWORK",
      at: incident.firstSeenAt,
    },
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return {
    incident,
    asset,
    recommendation,
    timeline,
    ageMinutes,
    recoveryEvidence,
    sla: {
      open: openSla.length,
      ack: openSla.filter((item) => item.breachType === "ACK_SLA_BREACH").length,
      resolution: openSla.filter(
        (item) => item.breachType === "RESOLUTION_SLA_BREACH",
      ).length,
      lastDetectedAt: openSla[0]?.detectedAt ?? null,
    },
    delivery: {
      health: deliveryHealth,
      total: incident.alertDeliveries.length,
      sent: deliverySent,
      simulated: deliverySimulated,
      pending: deliveryPending,
      failed: deliveryFailed,
      lastStatus: incident.alertDeliveries[0]?.status ?? "NO_DATA",
      lastError:
        incident.alertDeliveries.find((delivery) => delivery.errorMessage)
          ?.errorMessage ?? null,
    },
  };
}
