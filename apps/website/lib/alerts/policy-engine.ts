import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const severityOrder: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function eligible(incidentSeverity: string, minSeverity: string) {
  return (severityOrder[incidentSeverity] ?? 0) >= (severityOrder[minSeverity] ?? 99);
}

function deliveryFingerprint(input: {
  incidentId: string;
  policyId: string;
  channel: string;
  recipient: string;
  attempt: number;
}) {
  return [
    input.incidentId,
    input.policyId,
    input.channel,
    input.recipient,
    String(input.attempt),
  ].join("|");
}

export async function evaluateAlertPolicies(organizationId: string) {
  const [policies, incidents, connectors] = await Promise.all([
    prisma.alertPolicy.findMany({
      where: { organizationId, enabled: true },
      orderBy: { name: "asc" },
    }),

    prisma.infrastructureIncident.findMany({
      where: {
        organizationId,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
      orderBy: [{ riskScore: "desc" }, { lastSeenAt: "desc" }],
    }),

    prisma.notificationConnector.findMany({
      where: {
        organizationId,
        enabled: true,
      },
    }),
  ]);

  const now = new Date();
  let created = 0;
  let escalations = 0;
  let skipped = 0;

  for (const incident of incidents) {
    for (const policy of policies) {
      if (!eligible(incident.severity, policy.minSeverity)) {
        skipped += 1;
        continue;
      }

      const ageMinutes = Math.floor(
        (now.getTime() - incident.firstSeenAt.getTime()) / 60000,
      );

      const shouldEscalate =
        incident.status !== "RESOLVED" &&
        ageMinutes >= policy.escalateAfterMinutes;

      const attempt = shouldEscalate ? 2 : 1;

      for (const channel of policy.channels) {
       const connector = connectors.find(
         (item) => item.type === channel,
       );

       const connectorIsLive = connector?.mode === "LIVE";

       for (const recipient of policy.recipients) {
          const key = deliveryFingerprint({
            incidentId: incident.id,
            policyId: policy.id,
            channel,
            recipient,
            attempt,
          });

const deliveryKey = connectorIsLive
  ? `${key}|LIVE`
  : `${key}|SIMULATED`;

const blockingStatuses = connectorIsLive
  ? [
      "PENDING",
      "RETRY_PENDING",
      "SENT",
      "FAILED",
    ]
  : [
      "PENDING",
      "RETRY_PENDING",
      "SIMULATED",
    ];

const existing =
  await prisma.alertDelivery.findFirst({
    where: {
      organizationId,
      incidentId: incident.id,
      policyId: policy.id,
      channel,
      recipient,
      attempt,

      status: {
        in: blockingStatuses,
      },

      payload: {
        path: ["fingerprint"],
        equals: deliveryKey,
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });

if (existing) {
  continue;
}

          const payload: Prisma.InputJsonValue = {
            fingerprint: deliveryKey,
            incidentExternalId: incident.externalId,
            title: incident.title,
            severity: incident.severity,
            riskScore: incident.riskScore,
            blastRadius: incident.blastRadius,
            site: incident.site,
            instanceName: incident.instanceName,
            assetName: incident.assetName,
            assetType: incident.assetType,
            escalation: shouldEscalate,
            policyName: policy.name,
          };

          await prisma.alertDelivery.create({
            data: {
              organizationId,
              incidentId: incident.id,
              policyId: policy.id,
              channel,
              recipient,
              status: "PENDING",
              attempt,
              payload,
            },
          });

          if (shouldEscalate) escalations += 1;
          else created += 1;
        }
      }
    }
  }

  return {
    policies: policies.length,
    incidents: incidents.length,
    created,
    escalations,
    skipped,
  };
}

export async function dispatchPendingAlerts(organizationId: string) {
  const deliveries = await prisma.alertDelivery.findMany({
    where: { organizationId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  let simulated = 0;

  for (const delivery of deliveries) {
    /*
     * 015.6.8 trabalha em modo seguro:
     * registra e simula a entrega, mas não envia e-mail/WhatsApp/Slack
     * sem conector explicitamente configurado.
     */
    await prisma.alertDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SIMULATED",
        sentAt: new Date(),
        errorMessage: null,
      },
    });
    simulated += 1;
  }

  return { pending: deliveries.length, simulated };
}
