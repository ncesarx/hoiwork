import { Prisma } from "@prisma/client";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { reconcileAutonomousGovernanceState } from "@/lib/governance/autonomous-recovery-audit";

export type AutonomousGovernanceAutomationSource =
  | "MANUAL"
  | "SCHEDULER";

type LockedExecution<T> =
  | {
      acquired: true;
      result: T;
    }
  | {
      acquired: false;
    };

async function withOrganizationLock<T>(
  organizationId: string,
  execute: () => Promise<T>,
): Promise<LockedExecution<T>> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  let acquired = false;
  try {
    const lock = await client.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock(
        hashtext($1), hashtext($2)
      ) AS acquired`,
      ["hoiwork:autonomous-governance-automation", organizationId],
    );
    acquired = Boolean(lock.rows[0]?.acquired);
    if (!acquired) return { acquired: false };

    return { acquired: true, result: await execute() };
  } finally {
    try {
      if (acquired) {
        await client.query(
          `SELECT pg_advisory_unlock(hashtext($1), hashtext($2))`,
          ["hoiwork:autonomous-governance-automation", organizationId],
        );
      }
    } finally {
      await client.end();
    }
  }
}

export async function runAutonomousGovernanceAutomation(input: {
  organizationId: string;
  source: AutonomousGovernanceAutomationSource;
  respectEnabled?: boolean;
  dryRunOnly?: boolean;
}) {
  const config =
    await prisma.autonomousGovernanceAutomationConfig.upsert({
      where: {
        organizationId: input.organizationId,
      },
      update: {},
      create: {
        organizationId: input.organizationId,
        enabled: false,
        intervalMinutes: 5,
        commitEnabled: false,
      },
    });

  if (input.respectEnabled && !config.enabled) {
    return {
      skipped: true as const,
      reason: "AUTONOMOUS_GOVERNANCE_AUTOMATION_DISABLED",
    };
  }

  const due =
    !config.lastRunAt ||
    Date.now() - config.lastRunAt.getTime() >=
      config.intervalMinutes * 60_000;

  if (input.respectEnabled && !due) {
    return {
      skipped: true as const,
      reason: "INTERVAL_NOT_DUE",
    };
  }

  let runId: string | null = null;

  try {
    const locked = await withOrganizationLock(
      input.organizationId,
      async () => {
        const lockedConfig =
          await prisma.autonomousGovernanceAutomationConfig.findUniqueOrThrow({
            where: { organizationId: input.organizationId },
          });
        if (input.respectEnabled && !lockedConfig.enabled) {
          return {
            skipped: true as const,
            reason: "AUTONOMOUS_GOVERNANCE_AUTOMATION_DISABLED",
          };
        }
        if (
          input.respectEnabled &&
          lockedConfig.lastRunAt &&
          Date.now() - lockedConfig.lastRunAt.getTime() <
            lockedConfig.intervalMinutes * 60_000
        ) {
          return {
            skipped: true as const,
            reason: "INTERVAL_NOT_DUE",
          };
        }

        const startedAt = new Date();

        const commit = lockedConfig.commitEnabled && !input.dryRunOnly;
        const mode = commit
          ? "COMMIT"
          : "DRY_RUN";

        const run =
          await prisma.autonomousGovernanceAutomationRun.create({
            data: {
              organizationId: input.organizationId,
              source: input.source,
              mode,
              status: "RUNNING",
              startedAt,
            },
          });

        runId = run.id;

        const reconciliation =
          await reconcileAutonomousGovernanceState({
            organizationId: input.organizationId,
            source: input.source,
            commit,
          });

        const capabilities =
          reconciliation.actions.length;

        const changed =
          reconciliation.actions.filter(
            (action) => action.changed === true,
          ).length;

        const authorized =
          reconciliation.actions.filter(
            (action) =>
              action.effectiveDecision === "AUTHORIZED",
          ).length;

        const restricted =
          reconciliation.actions.filter(
            (action) =>
              action.effectiveDecision === "RESTRICTED",
          ).length;

        const blocked =
          reconciliation.actions.filter(
            (action) =>
              action.effectiveDecision === "BLOCKED",
          ).length;

        const finishedAt = new Date();
        const durationMs =
          finishedAt.getTime() - startedAt.getTime();

        await prisma.autonomousGovernanceAutomationRun.update({
          where: {
            id: run.id,
          },
          data: {
            status: "COMPLETED",
            finishedAt,
            durationMs,
            capabilities,
            changed,
            authorized,
            restricted,
            blocked,
            metadata: {
              version: "015.6.11.7.5.1",
              globalCandidateDecision:
                reconciliation.globalCandidateDecision,
              asymmetricHysteresis:
                reconciliation.asymmetricHysteresis,
              recoveryEligible:
                reconciliation.recentRecovery.eligible,
            } as Prisma.InputJsonValue,
          },
        });

        await prisma.autonomousGovernanceAutomationConfig.update({
          where: {
            organizationId: input.organizationId,
          },
          data: {
            lastRunAt: finishedAt,
            lastSuccessAt: finishedAt,
            lastError: null,
            consecutiveFailures: 0,
          },
        });

        return {
          skipped: false as const,
          runId: run.id,
          status: "COMPLETED" as const,
          mode,
          capabilities,
          changed,
          authorized,
          restricted,
          blocked,
          durationMs,
          evaluatedAt: reconciliation.evaluatedAt,
          globalCandidateDecision:
            reconciliation.globalCandidateDecision,
        };
      },
    );

    if (!locked.acquired) {
      return {
        skipped: true as const,
        reason: "CONCURRENT_RUN",
      };
    }

    return locked.result;
  } catch (error) {
    const finishedAt = new Date();

    const message =
      error instanceof Error
        ? error.message
        : "Falha na automação de Autonomous Governance.";

    if (runId) {
      const failedRun =
        await prisma.autonomousGovernanceAutomationRun
          .findUnique({
            where: {
              id: runId,
            },
            select: {
              startedAt: true,
            },
          })
          .catch(() => null);

      await prisma.autonomousGovernanceAutomationRun
        .update({
          where: {
            id: runId,
          },
          data: {
            status: "FAILED",
            finishedAt,
            durationMs: failedRun?.startedAt
              ? finishedAt.getTime() -
                failedRun.startedAt.getTime()
              : null,
            errorMessage: message,
          },
        })
        .catch(() => {});
    }

    await prisma.autonomousGovernanceAutomationConfig
      .update({
        where: {
          organizationId: input.organizationId,
        },
        data: {
          lastRunAt: finishedAt,
          lastFailureAt: finishedAt,
          lastError: message,
          consecutiveFailures: {
            increment: 1,
          },
        },
      })
      .catch(() => {});

    throw error;
  }
}
