import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendSmtpMail, smtpConfig } from "@/lib/notifications/smtp";

type ConnectorConfig = { url?: string };

function configOf(value: Prisma.JsonValue | null): ConnectorConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as ConnectorConfig;
}

function jsonObject(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, Prisma.JsonValue>;
}

function secretValue(secretRef: string | null) {
  if (!secretRef) return undefined;
  return process.env[secretRef];
}

async function sendWebhook(
  url: string,
  secret: string | undefined,
  payload: unknown,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Webhook HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function dispatchAlertDeliveries(organizationId: string) {
  const deliveries = await prisma.alertDelivery.findMany({
    where: {
      organizationId,
      status: { in: ["PENDING", "RETRY_PENDING"] },
      attempt: { lte: 3 },
    },
    include: {
      incident: true,
      policy: true,
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  const connectors = await prisma.notificationConnector.findMany({
    where: {
      organizationId,
      enabled: true,
    },
  });

  let sent = 0;
  let simulated = 0;
  let failed = 0;
  let retryPending = 0;

  for (const delivery of deliveries) {
    const connector = connectors.find(
      (item) => item.type === delivery.channel,
    );

    if (!connector) {
      await prisma.alertDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "FAILED",
          errorMessage: `Conector ${delivery.channel} não configurado.`,
        },
      });
      failed += 1;
      continue;
    }

    if (connector.mode !== "LIVE") {
      await prisma.alertDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SIMULATED",
          sentAt: new Date(),
          errorMessage: null,
        },
      });
      simulated += 1;
      continue;
    }

    const dispatchStartedAt = new Date();

    try {
      const secret = secretValue(connector.secretRef);

      if (connector.type === "WEBHOOK") {
        const config = configOf(connector.config);

        if (!config.url) {
          throw new Error("URL do webhook não configurada.");
        }

        await sendWebhook(config.url, secret, {
          title: delivery.incident.title,
          severity: delivery.incident.severity,
          riskScore: delivery.incident.riskScore,
          blastRadius: delivery.incident.blastRadius,
          site: delivery.incident.site,
          asset: delivery.incident.assetName,
          recipient: delivery.recipient,
          attempt: delivery.attempt,
        });
      } else if (connector.type === "EMAIL") {
        const config = smtpConfig(connector.config);

        const subject =
          `[HOIWORK][${delivery.incident.severity}] ` +
          delivery.incident.title;

        const text = [
          delivery.incident.title,
          `Severidade: ${delivery.incident.severity}`,
          `Risk Score: ${delivery.incident.riskScore}`,
          `Blast Radius: ${delivery.incident.blastRadius}`,
          `Site: ${delivery.incident.site ?? "N/D"}`,
          `Proxmox: ${delivery.incident.instanceName ?? "N/D"}`,
          `Ativo: ${delivery.incident.assetName}`,
          `Tipo: ${delivery.incident.assetType}`,
          `Tentativa: ${delivery.attempt}`,
        ].join("\n");

        await sendSmtpMail({
          config,
          password: secret,
          to: delivery.recipient,
          subject,
          text,
        });
      } else if (connector.type === "WHATSAPP") {
        throw new Error("WhatsApp LIVE ainda requer provider.");
      } else {
        throw new Error(
          `Tipo de conector não suportado: ${connector.type}`,
        );
      }

      const sentAt = new Date();
      const transportLatencyMs =
        sentAt.getTime() - dispatchStartedAt.getTime();

      const endToEndLatencyMs =
        sentAt.getTime() - delivery.createdAt.getTime();

      const queueGovernanceLatencyMs = Math.max(
        0,
        endToEndLatencyMs - transportLatencyMs,
      );

      const previousPayload = jsonObject(delivery.payload);

      const payload: Prisma.InputJsonValue = {
        ...previousPayload,
        telemetry: {
          dispatchStartedAt: dispatchStartedAt.toISOString(),
          transportLatencyMs,
          queueGovernanceLatencyMs,
          endToEndLatencyMs,
          telemetryVersion: "015.6.10.1b",
        },
      };

      await prisma.alertDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SENT",
          sentAt,
          errorMessage: null,
          payload,
        },
      });

      sent += 1;
    } catch (error) {
      const finishedAt = new Date();
      const transportAttemptLatencyMs =
        finishedAt.getTime() - dispatchStartedAt.getTime();

      const message =
        error instanceof Error ? error.message : "Falha de entrega.";

      const nextAttempt = delivery.attempt + 1;
      const canRetry = nextAttempt <= 3;
      const previousPayload = jsonObject(delivery.payload);

      const payload: Prisma.InputJsonValue = {
        ...previousPayload,
        lastFailedDispatch: {
          startedAt: dispatchStartedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          transportAttemptLatencyMs,
          error: message,
          telemetryVersion: "015.6.10.1b",
        },
      };

      await prisma.alertDelivery.update({
        where: { id: delivery.id },
        data: {
          status: canRetry ? "RETRY_PENDING" : "FAILED",
          attempt: nextAttempt,
          errorMessage: message,
          payload,
        },
      });

      if (canRetry) retryPending += 1;
      else failed += 1;
    }
  }

  return {
    processed: deliveries.length,
    sent,
    simulated,
    retryPending,
    failed,
  };
}
