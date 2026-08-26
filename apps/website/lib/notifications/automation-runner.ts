import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { evaluateAlertPolicies } from "@/lib/alerts/policy-engine";
import { governAlertDeliveries } from "@/lib/notifications/governance";
import { dispatchAlertDeliveries } from "@/lib/notifications/dispatcher";

export type AutomationSource = "MANUAL" | "SCHEDULER";

async function acquireLock(organizationId: string) {
  const key = `hoiwork:notification-automation:${organizationId}`;

  const rows = await prisma.$queryRaw<Array<{ acquired: boolean }>>(
    Prisma.sql`SELECT pg_try_advisory_lock(hashtext(${key})) AS acquired`,
  );

  return {
    acquired: Boolean(rows[0]?.acquired),
    key,
  };
}

async function releaseLock(key: string) {
  await prisma.$queryRaw(
    Prisma.sql`SELECT pg_advisory_unlock(hashtext(${key}))`,
  );
}

export async function runNotificationAutomation(input: {
  organizationId: string;
  source: AutomationSource;
  respectEnabled?: boolean;
}) {
  const config = await prisma.notificationAutomationConfig.upsert({
    where: { organizationId: input.organizationId },
    update: {},
    create: {
      organizationId: input.organizationId,
      enabled: false,
      intervalMinutes: 5,
    },
  });

  if (input.respectEnabled && !config.enabled) {
    return {
      skipped: true,
      reason: "AUTOMATION_DISABLED",
    };
  }

  const lock = await acquireLock(input.organizationId);

  if (!lock.acquired) {
    return {
      skipped: true,
      reason: "CONCURRENT_RUN",
    };
  }

  const startedAt = new Date();
  const run = await prisma.notificationAutomationRun.create({
    data: {
      organizationId: input.organizationId,
      source: input.source,
      status: "RUNNING",
      startedAt,
    },
  });

  try {
    const evaluation = await evaluateAlertPolicies(input.organizationId);
    const governance = await governAlertDeliveries(input.organizationId);
    const dispatch = await dispatchAlertDeliveries(input.organizationId);

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    await prisma.notificationAutomationRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        finishedAt,
        durationMs,
        policiesEvaluated: evaluation.policies,
        incidentsEvaluated: evaluation.incidents,
        alertsCreated: evaluation.created,
        escalationsCreated: evaluation.escalations,
        heldMaintenance: governance.heldMaintenance,
        heldCooldown: governance.heldCooldown,
        released: governance.released,
        deliveriesProcessed: dispatch.processed,
        sent: dispatch.sent,
        simulated: dispatch.simulated,
        retryPending: dispatch.retryPending,
        failed: dispatch.failed,
        metadata: {
          evaluationSkipped: evaluation.skipped,
          maintenanceActive: governance.maintenanceActive,
          maintenanceWindows: governance.maintenanceWindows,
        },
      },
    });

    await prisma.notificationAutomationConfig.update({
      where: { organizationId: input.organizationId },
      data: {
        lastRunAt: finishedAt,
        lastSuccessAt: finishedAt,
        lastError: null,
      },
    });

    return {
      skipped: false,
      runId: run.id,
      status: "COMPLETED",
      durationMs,
      evaluation,
      governance,
      dispatch,
    };
  } catch (error) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const message =
      error instanceof Error ? error.message : "Falha desconhecida na automação.";

    await prisma.notificationAutomationRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt,
        durationMs,
        errorMessage: message,
      },
    });

    await prisma.notificationAutomationConfig.update({
      where: { organizationId: input.organizationId },
      data: {
        lastRunAt: finishedAt,
        lastError: message,
      },
    });

    throw error;
  } finally {
    await releaseLock(lock.key).catch(() => {});
  }
}
