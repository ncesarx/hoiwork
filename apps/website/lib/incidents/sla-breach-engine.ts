import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type BreachType = "ACK_SLA_BREACH" | "RESOLUTION_SLA_BREACH";

const SLA_MINUTES: Record<Severity, { acknowledge: number; resolve: number }> = {
  CRITICAL: { acknowledge: 15, resolve: 120 },
  HIGH: { acknowledge: 30, resolve: 240 },
  MEDIUM: { acknowledge: 120, resolve: 720 },
  LOW: { acknowledge: 240, resolve: 1440 },
};

const RANK: Record<Severity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function severityOf(value: string): Severity {
  return ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(value)
    ? (value as Severity)
    : "LOW";
}

function ageMinutes(from: Date, to = new Date()) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60000));
}

function eligible(incidentSeverity: string, minimumSeverity: string) {
  return RANK[severityOf(incidentSeverity)] >= RANK[severityOf(minimumSeverity)];
}

function escalationFingerprint(incidentId: string, breachType: BreachType) {
  return `${incidentId}|${breachType}|015.6.11.3.2`;
}

function deliveryFingerprint(input: {
  incidentId: string;
  breachType: BreachType;
  policyId: string;
  channel: string;
  recipient: string;
}) {
  return [
    "SLA",
    input.incidentId,
    input.breachType,
    input.policyId,
    input.channel,
    input.recipient,
  ].join("|");
}

export async function evaluateIncidentSlaBreaches(input: {
  organizationId: string;
  source?: "MANUAL" | "SCHEDULER";
  commit?: boolean;
}) {
  const startedAt = new Date();
  const commit = Boolean(input.commit);
  const source = input.source ?? "MANUAL";

  const run = await prisma.incidentSlaEvaluationRun.create({
    data: {
      organizationId: input.organizationId,
      source,
      status: "RUNNING",
      startedAt,
    },
  });

  const [incidents, policies] = await Promise.all([
    prisma.infrastructureIncident.findMany({
      where: {
        organizationId: input.organizationId,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
      orderBy: [{ riskScore: "desc" }, { createdAt: "asc" }],
    }),
    prisma.alertPolicy.findMany({
      where: {
        organizationId: input.organizationId,
        enabled: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  let ackBreaches = 0;
  let resolveBreaches = 0;
  let escalationsCreated = 0;
  let skipped = 0;
  let errors = 0;
  const details: Array<Record<string, unknown>> = [];

  try {
    for (const incident of incidents) {
      const severity = severityOf(incident.severity);
      const sla = SLA_MINUTES[severity];
      const age = ageMinutes(incident.createdAt);

      const breaches: BreachType[] = [];

      if (!incident.acknowledgedAt && age > sla.acknowledge) {
        breaches.push("ACK_SLA_BREACH");
        ackBreaches += 1;
      }

      if (!incident.resolvedAt && age > sla.resolve) {
        breaches.push("RESOLUTION_SLA_BREACH");
        resolveBreaches += 1;
      }

      if (!breaches.length) {
        skipped += 1;
        details.push({
          incidentId: incident.id,
          title: incident.title,
          action: "WITHIN_SLA",
          ageMinutes: age,
        });
        continue;
      }

      for (const breachType of breaches) {
        const fingerprint = escalationFingerprint(incident.id, breachType);

        const existing = await prisma.incidentSlaEscalation.findUnique({
          where: {
            organizationId_fingerprint: {
              organizationId: input.organizationId,
              fingerprint,
            },
          },
        });

        if (existing?.status === "OPEN") {
          details.push({
            incidentId: incident.id,
            title: incident.title,
            breachType,
            action: "ALREADY_ESCALATED",
            escalationId: existing.id,
          });
          continue;
        }

        if (!commit) {
          details.push({
            incidentId: incident.id,
            title: incident.title,
            breachType,
            action: existing ? "WOULD_REOPEN" : "WOULD_ESCALATE",
            ageMinutes: age,
          });
          continue;
        }

        const escalation = existing
          ? await prisma.incidentSlaEscalation.update({
              where: { id: existing.id },
              data: {
                status: "OPEN",
                detectedAt: new Date(),
                clearedAt: null,
                severity,
                metadata: {
                  ageMinutes: age,
                  acknowledgedAt: incident.acknowledgedAt?.toISOString() ?? null,
                  resolvedAt: incident.resolvedAt?.toISOString() ?? null,
                  version: "015.6.11.3.2",
                } as Prisma.InputJsonValue,
              },
            })
          : await prisma.incidentSlaEscalation.create({
              data: {
                organizationId: input.organizationId,
                incidentId: incident.id,
                breachType,
                severity,
                fingerprint,
                metadata: {
                  ageMinutes: age,
                  acknowledgedAt: incident.acknowledgedAt?.toISOString() ?? null,
                  resolvedAt: incident.resolvedAt?.toISOString() ?? null,
                  version: "015.6.11.3.2",
                } as Prisma.InputJsonValue,
              },
            });

        escalationsCreated += 1;

        await prisma.infrastructureIncidentEvent.create({
          data: {
            organizationId: input.organizationId,
            incidentId: incident.id,
            eventType: breachType,
            message:
              breachType === "ACK_SLA_BREACH"
                ? "SLA de reconhecimento excedido."
                : "SLA de resolução excedido.",
            actorName: "HOIWORK SLA Engine",
            metadata: {
              escalationId: escalation.id,
              ageMinutes: age,
              slaMinutes:
                breachType === "ACK_SLA_BREACH"
                  ? sla.acknowledge
                  : sla.resolve,
              version: "015.6.11.3.2",
            },
          },
        });

        for (const policy of policies) {
          if (!eligible(severity, policy.minSeverity)) continue;

          for (const channel of policy.channels) {
            for (const recipient of policy.recipients) {
              const deliveryKey = deliveryFingerprint({
                incidentId: incident.id,
                breachType,
                policyId: policy.id,
                channel,
                recipient,
              });

              const alreadyQueued = await prisma.alertDelivery.findFirst({
                where: {
                  organizationId: input.organizationId,
                  incidentId: incident.id,
                  policyId: policy.id,
                  channel,
                  recipient,
                  payload: {
                    path: ["fingerprint"],
                    equals: deliveryKey,
                  },
                },
              });

              if (alreadyQueued) continue;

              await prisma.alertDelivery.create({
                data: {
                  organizationId: input.organizationId,
                  incidentId: incident.id,
                  policyId: policy.id,
                  channel,
                  recipient,
                  status: "PENDING",
                  attempt: 1,
                  payload: {
                    fingerprint: deliveryKey,
                    type: "SLA_BREACH",
                    breachType,
                    escalationId: escalation.id,
                    title: incident.title,
                    severity,
                    riskScore: incident.riskScore,
                    assetName: incident.assetName,
                    site: incident.site,
                    ageMinutes: age,
                    slaMinutes:
                      breachType === "ACK_SLA_BREACH"
                        ? sla.acknowledge
                        : sla.resolve,
                    policyName: policy.name,
                  } as Prisma.InputJsonValue,
                },
              });
            }
          }
        }

        details.push({
          incidentId: incident.id,
          title: incident.title,
          breachType,
          action: existing ? "REOPENED" : "ESCALATED",
          escalationId: escalation.id,
          ageMinutes: age,
        });
      }
    }

    // Clear escalations whose breach condition is no longer active.
    if (commit) {
      const openEscalations = await prisma.incidentSlaEscalation.findMany({
        where: {
          organizationId: input.organizationId,
          status: "OPEN",
        },
        include: { incident: true },
      });

      for (const escalation of openEscalations) {
        const incident = escalation.incident;
        const severity = severityOf(incident.severity);
        const sla = SLA_MINUTES[severity];
        const age = ageMinutes(incident.createdAt);

        const stillBreached =
          escalation.breachType === "ACK_SLA_BREACH"
            ? !incident.acknowledgedAt && !incident.resolvedAt && age > sla.acknowledge
            : !incident.resolvedAt && age > sla.resolve;

        if (!stillBreached) {
          await prisma.incidentSlaEscalation.update({
            where: { id: escalation.id },
            data: {
              status: "CLEARED",
              clearedAt: new Date(),
            },
          });

          await prisma.infrastructureIncidentEvent.create({
            data: {
              organizationId: input.organizationId,
              incidentId: incident.id,
              eventType: "SLA_BREACH_CLEARED",
              message: `Escalonamento ${escalation.breachType} encerrado.`,
              actorName: "HOIWORK SLA Engine",
              metadata: {
                escalationId: escalation.id,
                breachType: escalation.breachType,
                version: "015.6.11.3.2",
              },
            },
          });
        }
      }
    }

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    await prisma.incidentSlaEvaluationRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        finishedAt,
        durationMs,
        inspected: incidents.length,
        ackBreaches,
        resolveBreaches,
        escalationsCreated,
        skipped,
        errors,
        details: details as Prisma.InputJsonValue,
      },
    });

    return {
      runId: run.id,
      mode: commit ? "COMMIT" : "DRY_RUN",
      inspected: incidents.length,
      ackBreaches,
      resolveBreaches,
      escalationsCreated,
      skipped,
      errors,
      durationMs,
      details,
    };
  } catch (error) {
    errors += 1;
    const finishedAt = new Date();
    const message =
      error instanceof Error ? error.message : "Falha no SLA Breach Engine.";

    await prisma.incidentSlaEvaluationRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        inspected: incidents.length,
        ackBreaches,
        resolveBreaches,
        escalationsCreated,
        skipped,
        errors,
        errorMessage: message,
        details: details as Prisma.InputJsonValue,
      },
    });

    throw error;
  }
}
