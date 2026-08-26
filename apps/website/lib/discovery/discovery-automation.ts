import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { discoverProxmoxInstance } from "@/integrations/discovery/multi-proxmox-engine";
import { reconcileInfrastructureIncidents } from "@/lib/incidents/reconciliation-engine";
import { classifyConnectorFailure } from "@/lib/observability/connector-failure-classifier";
import { runIncidentRecurrenceDetection } from "@/lib/incidents/incident-recurrence";

export type DiscoveryAutomationSource = "MANUAL" | "SCHEDULER";

type InstanceDiscoveryResult = {
  discovered?: number;
};

const runInstanceDiscovery = discoverProxmoxInstance as unknown as (input: {
  organizationId: string;
  instanceId: string;
}) => Promise<InstanceDiscoveryResult>;

async function acquireLock(organizationId: string) {
  const key = `hoiwork:discovery-automation:${organizationId}`;

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

export async function runDiscoveryAutomation(input: {
  organizationId: string;
  source: DiscoveryAutomationSource;
  respectEnabled?: boolean;
}) {
  const config = await prisma.discoveryAutomationConfig.upsert({
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
      skipped: true as const,
      reason: "DISCOVERY_AUTOMATION_DISABLED",
    };
  }

  const due =
    !config.lastRunAt ||
    Date.now() - config.lastRunAt.getTime() >= config.intervalMinutes * 60000;

  if (input.respectEnabled && !due) {
    return {
      skipped: true as const,
      reason: "INTERVAL_NOT_DUE",
    };
  }

  const lock = await acquireLock(input.organizationId);

  if (!lock.acquired) {
    return {
      skipped: true as const,
      reason: "CONCURRENT_RUN",
    };
  }

  const startedAt = new Date();

  const instances = await prisma.proxmoxInstance.findMany({
    where: {
      organizationId: input.organizationId,
      enabled: true,
    },
    orderBy: [{ site: "asc" }, { name: "asc" }],
  });

  const run = await prisma.discoveryAutomationRun.create({
    data: {
      organizationId: input.organizationId,
      source: input.source,
      status: "RUNNING",
      startedAt,
      instancesTotal: instances.length,
    },
  });

  let succeeded = 0;
  let failed = 0;
  let assetsDiscovered = 0;
  const details: Array<Record<string, unknown>> = [];

  try {
    for (const instance of instances) {
      const instanceStartedAt = new Date();

      try {
        const result = await runInstanceDiscovery({
          organizationId: input.organizationId,
          instanceId: instance.id,
        });

        const finishedAt = new Date();
        const discovered =
          typeof result?.discovered === "number" ? result.discovered : 0;

        assetsDiscovered += discovered;
        succeeded += 1;

        await prisma.proxmoxInstance.update({
          where: { id: instance.id },
          data: {
            status: "HEALTHY",
            lastSyncAt: finishedAt,
            lastHealthAt: finishedAt,
            lastError: null,
          },
        });

        details.push({
          kind: "INSTANCE",
          instanceId: instance.id,
          name: instance.name,
          site: instance.site,
          status: "COMPLETED",
          discovered,
          durationMs: finishedAt.getTime() - instanceStartedAt.getTime(),
        });
      } catch (error) {
        failed += 1;
        const finishedAt = new Date();
        const message =
          error instanceof Error ? error.message : "Falha desconhecida.";

        const failure = classifyConnectorFailure(error);

        await prisma.proxmoxInstance.update({
          where: { id: instance.id },
          data: {
            status:
              failure.category === "CONNECTIVITY" ||
              failure.category === "TLS" ||
              failure.category === "AUTHENTICATION" ||
              failure.category === "AUTHORIZATION" ||
              failure.category === "CONFIGURATION"
                ? "ERROR"
                : instance.status,
            lastHealthAt: finishedAt,
            lastError: message,
          },
        });

        details.push({
          kind: "INSTANCE",
          instanceId: instance.id,
          name: instance.name,
          site: instance.site,
          status: "FAILED",
          error: message,
          failure: {
            version: failure.version,
            category: failure.category,
            reason: failure.reason,
            severity: failure.severity,
            retryable: failure.retryable,
            recoverable: failure.recoverable,
            httpStatus: failure.httpStatus,
            networkCode: failure.networkCode,
            recommendedAction: failure.recommendedAction,
            evidence: failure.evidence,
          },
          durationMs: finishedAt.getTime() - instanceStartedAt.getTime(),
        });
      }
    }

    const discoveryFinishedAt = new Date();
    const durationMs = discoveryFinishedAt.getTime() - startedAt.getTime();

    const status =
      instances.length === 0
        ? "NO_INSTANCES"
        : failed === 0
          ? "COMPLETED"
          : succeeded > 0
            ? "DEGRADED"
            : "FAILED";

    const summaryError =
      failed > 0
        ? `${failed} de ${instances.length} instância(s) falharam.`
        : instances.length === 0
          ? "Nenhuma instância Proxmox habilitada."
          : null;

    await prisma.discoveryAutomationRun.update({
      where: { id: run.id },
      data: {
        status,
        finishedAt: discoveryFinishedAt,
        durationMs,
        instancesTotal: instances.length,
        succeeded,
        failed,
        assetsDiscovered,
        errorMessage: summaryError,
        details: details as Prisma.InputJsonValue,
      },
    });

    /*
     * Closed-loop gate:
     * reconciliation only runs after a fully successful, non-empty discovery.
     * A DEGRADED/FAILED/NO_INSTANCES run is never recovery evidence.
     */
    let reconciliation:
      | {
          status: "COMPLETED";
          runId: string;
          inspected: number;
          keptOpen: number;
          resolved: number;
          skipped: number;
          errors: number;
        }
      | {
          status: "SKIPPED";
          reason: string;
        }
      | {
          status: "FAILED";
          error: string;
        };

    const reconciliationEligible =
      status === "COMPLETED" &&
      instances.length > 0 &&
      succeeded === instances.length &&
      failed === 0;

    if (!config.reconciliationEnabled) {
      reconciliation = {
        status: "SKIPPED",
        reason: "LIFECYCLE_AUTOMATION_DISABLED",
      };
    } else if (!reconciliationEligible) {
      reconciliation = {
        status: "SKIPPED",
        reason: `DISCOVERY_${status}_NOT_ELIGIBLE`,
      };
    } else {
      try {
        const result = await reconcileInfrastructureIncidents({
          organizationId: input.organizationId,
          source: "DISCOVERY",
          commit: true,
          discoveryAutomationRunId: run.id,
        });

        reconciliation = {
          status: "COMPLETED",
          runId: result.runId,
          inspected: result.inspected,
          keptOpen: result.keptOpen,
          resolved: result.resolved,
          skipped: result.skipped,
          errors: result.errors,
        };

        details.push({
          kind: "INCIDENT_RECONCILIATION",
          discoveryAutomationRunId: run.id,
          reconciliationRunId: result.runId,
          status: "COMPLETED",
          inspected: result.inspected,
          keptOpen: result.keptOpen,
          resolved: result.resolved,
          skipped: result.skipped,
          errors: result.errors,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Falha na reconciliação pós-discovery.";

        reconciliation = {
          status: "FAILED",
          error: message,
        };

        details.push({
          kind: "INCIDENT_RECONCILIATION",
          discoveryAutomationRunId: run.id,
          status: "FAILED",
          error: message,
        });
      }
    }

    /*
     * 015.6.11.6.4.4 — Post-Closure Regression Guard
     */
    if (
      config.reconciliationEnabled &&
      reconciliationEligible &&
      reconciliation.status === "COMPLETED"
    ) {
      try {
        const recurrence = await runIncidentRecurrenceDetection(
          input.organizationId,
          {
            source: "DISCOVERY",
            postRemediationOnly: true,
            discoveryAutomationRunId: run.id,
            freshnessMaxMinutes: 15,
          },
        );

        details.push({
          kind: "POST_CLOSURE_REGRESSION_GUARD",
          discoveryAutomationRunId: run.id,
          status: "COMPLETED",
          inspected: recurrence.inspected,
          candidates: recurrence.candidates,
          created: recurrence.created,
          skippedOpenExists: recurrence.skippedOpenExists,
          skippedHealthy: recurrence.skippedHealthy,
          skippedStale: recurrence.skippedStale,
          postRemediationOnly: true,
          version: "015.6.11.6.4.4",
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Falha no Post-Closure Regression Guard.";

        details.push({
          kind: "POST_CLOSURE_REGRESSION_GUARD",
          discoveryAutomationRunId: run.id,
          status: "FAILED",
          error: message,
          version: "015.6.11.6.4.4",
        });
      }
    } else {
      details.push({
        kind: "POST_CLOSURE_REGRESSION_GUARD",
        discoveryAutomationRunId: run.id,
        status: "SKIPPED",
        reason:
          !config.reconciliationEnabled
            ? "LIFECYCLE_AUTOMATION_DISABLED"
            : !reconciliationEligible
              ? `DISCOVERY_${status}_NOT_ELIGIBLE`
              : `RECONCILIATION_${reconciliation.status}_NOT_ELIGIBLE`,
        version: "015.6.11.6.4.4",
      });
    }

    /*
     * Discovery outcome remains authoritative even if lifecycle reconciliation
     * fails. This preserves fault isolation between data collection and
     * incident lifecycle automation.
     */
    await prisma.discoveryAutomationRun.update({
      where: { id: run.id },
      data: {
        details: details as Prisma.InputJsonValue,
      },
    });

    await prisma.discoveryAutomationConfig.update({
      where: { organizationId: input.organizationId },
      data: {
        lastRunAt: discoveryFinishedAt,
        ...(failed === 0 && instances.length > 0
          ? {
              lastSuccessAt: discoveryFinishedAt,
              lastError: null,
              consecutiveFailures: 0,
            }
          : {
              lastFailureAt: discoveryFinishedAt,
              lastError: summaryError,
              consecutiveFailures: { increment: 1 },
            }),
      },
    });

    return {
      skipped: false as const,
      runId: run.id,
      status,
      durationMs,
      instances: instances.length,
      succeeded,
      failed,
      assetsDiscovered,
      reconciliation,
      details,
    };
  } catch (error) {
    const finishedAt = new Date();
    const message =
      error instanceof Error ? error.message : "Falha na automação Discovery.";

    await prisma.discoveryAutomationRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        succeeded,
        failed: Math.max(failed, 1),
        assetsDiscovered,
        errorMessage: message,
        details: details as Prisma.InputJsonValue,
      },
    });

    await prisma.discoveryAutomationConfig.update({
      where: { organizationId: input.organizationId },
      data: {
        lastRunAt: finishedAt,
        lastFailureAt: finishedAt,
        lastError: message,
        consecutiveFailures: { increment: 1 },
      },
    });

    throw error;
  } finally {
    await releaseLock(lock.key).catch(() => {});
  }
}
