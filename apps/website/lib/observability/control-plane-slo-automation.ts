import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { captureControlPlaneHealthSnapshot } from "@/lib/observability/control-plane-slo-snapshots";
import { buildControlPlaneSloReport } from "@/lib/observability/control-plane-slo-report";

export type ControlPlaneSloAutomationSource = "MANUAL" | "SCHEDULER";

async function acquireLock(organizationId: string) {
  const key = `hoiwork:control-plane-slo-automation:${organizationId}`;
  const rows = await prisma.$queryRaw<Array<{ acquired: boolean }>>(
    Prisma.sql`SELECT pg_try_advisory_lock(hashtext(${key})) AS acquired`,
  );
  return { acquired: Boolean(rows[0]?.acquired), key };
}

async function releaseLock(key: string) {
  await prisma.$queryRaw(Prisma.sql`SELECT pg_advisory_unlock(hashtext(${key}))`);
}

export async function runControlPlaneSloAutomation(input: {
  organizationId: string;
  source: ControlPlaneSloAutomationSource;
  respectEnabled?: boolean;
}) {
  const config = await prisma.controlPlaneSloPolicy.upsert({
    where: { organizationId: input.organizationId },
    update: {},
    create: { organizationId: input.organizationId, enabled: false, availabilityTarget: 99.5, degradedWeight: 0.5, criticalWeight: 0, snapshotIntervalMinutes: 5, retentionDays: 90 },
  });

  if (input.respectEnabled && !config.enabled)
    return { skipped: true as const, reason: "CONTROL_PLANE_SLO_AUTOMATION_DISABLED" };

  const due = !config.lastRunAt || Date.now() - config.lastRunAt.getTime() >= config.snapshotIntervalMinutes * 60000;
  if (input.respectEnabled && !due)
    return { skipped: true as const, reason: "INTERVAL_NOT_DUE" };

  const lock = await acquireLock(input.organizationId);
  if (!lock.acquired) return { skipped: true as const, reason: "CONCURRENT_RUN" };

  const startedAt = new Date();
  const run = await prisma.controlPlaneSloAutomationRun.create({
    data: { organizationId: input.organizationId, source: input.source, status: "RUNNING", startedAt },
  });

  try {
    const snapshot = await captureControlPlaneHealthSnapshot(input.organizationId);
    const report = await buildControlPlaneSloReport(input.organizationId, 24);
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    await prisma.controlPlaneSloAutomationRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", finishedAt, durationMs, snapshotId: snapshot.id, availability: report.availability, errorBudgetPercent: report.errorBudgetPercent, burnRate: report.burnRate, burnState: report.burnState, metadata: { version: "015.6.11.7.3.3", sampleCount: report.sampleCount, target: report.target, states: report.states } as Prisma.InputJsonValue },
    });

    await prisma.controlPlaneSloPolicy.update({
      where: { organizationId: input.organizationId },
      data: { lastRunAt: finishedAt, lastSuccessAt: finishedAt, lastError: null, consecutiveFailures: 0 },
    });

    return { skipped: false as const, runId: run.id, status: "COMPLETED", snapshotId: snapshot.id, capturedAt: snapshot.capturedAt, availability: report.availability, target: report.target, errorBudgetPercent: report.errorBudgetPercent, burnRate: report.burnRate, burnState: report.burnState, sampleCount: report.sampleCount, durationMs };
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : "Falha na automação do Control Plane SLO.";
    await prisma.controlPlaneSloAutomationRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), errorMessage: message } });
    await prisma.controlPlaneSloPolicy.update({ where: { organizationId: input.organizationId }, data: { lastRunAt: finishedAt, lastFailureAt: finishedAt, lastError: message, consecutiveFailures: { increment: 1 } } });
    throw error;
  } finally {
    await releaseLock(lock.key).catch(() => {});
  }
}
