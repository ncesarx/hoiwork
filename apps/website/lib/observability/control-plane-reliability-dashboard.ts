import { prisma } from "@/lib/prisma";
import { buildControlPlaneHealth } from "@/lib/observability/control-plane-health";
import { buildControlPlaneSloReport } from "@/lib/observability/control-plane-slo-report";

function minutesBetween(start: Date | null, end: Date | null) {
  if (!start || !end) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export async function buildControlPlaneReliabilityDashboard(
  organizationId: string,
) {
  const [
    health,
    slo24h,
    openSelfHealth,
    resolvedSelfHealth,
    lastSelfHealthIncident,
    recentSelfHealthEvents,
    recentAutomationRuns,
  ] = await Promise.all([
    buildControlPlaneHealth(organizationId),
    buildControlPlaneSloReport(organizationId, 24),

    prisma.infrastructureIncident.count({
      where: {
        organizationId,
        source: "HOIWORK_SELF_HEALTH",
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
    }),

    prisma.infrastructureIncident.count({
      where: {
        organizationId,
        source: "HOIWORK_SELF_HEALTH",
        status: "RESOLVED",
      },
    }),

    prisma.infrastructureIncident.findFirst({
      where: {
        organizationId,
        source: "HOIWORK_SELF_HEALTH",
      },
      orderBy: { firstSeenAt: "desc" },
    }),

    prisma.infrastructureIncidentEvent.findMany({
      where: {
        organizationId,
        eventType: {
          in: [
            "SELF_HEALTH_INCIDENT_OPENED",
            "SELF_HEALTH_INCIDENT_RESOLVED",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),

    prisma.controlPlaneSloAutomationRun.findMany({
      where: { organizationId },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

  const resolvedSamples = await prisma.infrastructureIncident.findMany({
    where: {
      organizationId,
      source: "HOIWORK_SELF_HEALTH",
      status: "RESOLVED",
      resolvedAt: { not: null },
    },
    orderBy: { resolvedAt: "desc" },
    take: 50,
    select: {
      firstSeenAt: true,
      resolvedAt: true,
    },
  });

  const mttrValues = resolvedSamples
    .map((item) => minutesBetween(item.firstSeenAt, item.resolvedAt))
    .filter((value): value is number => value !== null);

  const mttrMinutes =
    mttrValues.length > 0
      ? Math.round(
          mttrValues.reduce((sum, value) => sum + value, 0) /
            mttrValues.length,
        )
      : null;

  const latestRun = recentAutomationRuns[0] ?? null;

  return {
    version: "015.6.11.7.3.5",
    health,
    slo: {
      windowHours: slo24h.windowHours,
      availability: slo24h.availability,
      target: slo24h.target,
      errorBudgetPercent: slo24h.errorBudgetPercent,
      burnRate: slo24h.burnRate,
      burnState: slo24h.burnState,
      sampleCount: slo24h.sampleCount,
      states: slo24h.states,
      lastAutomationRun: latestRun
        ? {
            id: latestRun.id,
            source: latestRun.source,
            status: latestRun.status,
            startedAt: latestRun.startedAt,
            finishedAt: latestRun.finishedAt,
            errorMessage: latestRun.errorMessage,
          }
        : null,
    },
    selfHealth: {
      open: openSelfHealth,
      resolved: resolvedSelfHealth,
      mttrMinutes,
      lastIncident: lastSelfHealthIncident
        ? {
            id: lastSelfHealthIncident.id,
            title: lastSelfHealthIncident.title,
            status: lastSelfHealthIncident.status,
            severity: lastSelfHealthIncident.severity,
            assetExternalId: lastSelfHealthIncident.assetExternalId,
            firstSeenAt: lastSelfHealthIncident.firstSeenAt,
            resolvedAt: lastSelfHealthIncident.resolvedAt,
          }
        : null,
    },
    recentAutomationRuns: recentAutomationRuns.map((run) => ({
      id: run.id,
      source: run.source,
      status: run.status,
      snapshotId: run.snapshotId,
      availability: run.availability,
      errorBudgetPercent: run.errorBudgetPercent,
      burnRate: run.burnRate,
      burnState: run.burnState,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      durationMs: run.durationMs,
      errorMessage: run.errorMessage,
    })),
    auditTimeline: recentSelfHealthEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      message: event.message,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      createdAt: event.createdAt,
      incidentId: event.incidentId,
    })),
    evaluatedAt: new Date(),
  };
}
