import { prisma } from "@/lib/prisma";
import { buildNocHealthModel } from "@/lib/observability/noc-health";

type ExecutiveState = "HEALTHY" | "DEGRADED" | "CRITICAL" | "NO_DATA";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function stateFromScore(score: number | null): ExecutiveState {
  if (score === null) return "NO_DATA";
  if (score >= 90) return "HEALTHY";
  if (score >= 70) return "DEGRADED";
  return "CRITICAL";
}

function ageMinutes(date: Date | null) {
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

export async function buildExecutiveCockpit(organizationId: string) {
  const [
    proxmox,
    assets,
    incidents,
    notifications,
    automationConfig,
    latestSnapshot,
  ] = await Promise.all([
    prisma.proxmoxInstance.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.infrastructureAsset.findMany({
      where: { organizationId, active: true },
      select: {
      id: true,
      assetType: true,
      status: true,
      clusterName: true,
      nodeName: true,
   },
    }),
    prisma.infrastructureIncident.findMany({
      where: {
        organizationId,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
      orderBy: [{ riskScore: "desc" }, { lastSeenAt: "desc" }],
      take: 100,
    }),
    buildNocHealthModel(organizationId),
    prisma.notificationAutomationConfig.findUnique({
      where: { organizationId },
    }),
    prisma.notificationSloSnapshot.findFirst({
      where: { organizationId },
      orderBy: { capturedAt: "desc" },
    }),
  ]);

  const proxmoxHealthy = proxmox.filter(
    (item) => item.status === "HEALTHY" || item.status === "ONLINE",
  ).length;

  const proxmoxErrors = proxmox.filter(
    (item) => item.lastError || item.status === "ERROR" || item.status === "OFFLINE",
  ).length;

  const proxmoxScore = proxmox.length
    ? clamp(Math.round((proxmoxHealthy / proxmox.length) * 100) - proxmoxErrors * 10)
    : null;

  const critical = incidents.filter((item) => item.severity === "CRITICAL").length;
  const high = incidents.filter((item) => item.severity === "HIGH").length;
  const medium = incidents.filter((item) => item.severity === "MEDIUM").length;

  const maxRisk = incidents.length
    ? Math.max(...incidents.map((item) => item.riskScore))
    : 0;

  const incidentPenalty = critical * 18 + high * 8 + medium * 2;
  const incidentScore = clamp(100 - incidentPenalty);

  const notificationScore = notifications.nocHealthScore;

  const freshnessAges = proxmox
    .map((item) => ageMinutes(item.lastSyncAt ?? item.lastHealthAt))
    .filter((value): value is number => value !== null);

  const maxFreshnessAge = freshnessAges.length
    ? Math.max(...freshnessAges)
    : null;

  const freshnessScore =
    maxFreshnessAge === null
      ? null
      : maxFreshnessAge <= 5
        ? 100
        : maxFreshnessAge <= 15
          ? 85
          : maxFreshnessAge <= 60
            ? 60
            : 30;

  const components = [
    proxmoxScore,
    incidentScore,
    notificationScore,
    freshnessScore,
  ].filter((value): value is number => value !== null);

  const executiveScore = components.length
    ? Math.round(components.reduce((a, b) => a + b, 0) / components.length)
    : null;

  const state = stateFromScore(executiveScore);

 const sites = Array.from(
  new Set(
    proxmox
      .map((item) => item.site)
      .filter((value): value is string => Boolean(value)),
  ),
);

  const assetTypes = assets.reduce<Record<string, number>>((acc, item) => {
    acc[item.assetType] = (acc[item.assetType] ?? 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date(),
    state,
    executiveScore,
    components: {
      infrastructure: proxmoxScore,
      incidents: incidentScore,
      notifications: notificationScore,
      freshness: freshnessScore,
    },
    infrastructure: {
      proxmoxTotal: proxmox.length,
      proxmoxHealthy,
      proxmoxErrors,
      activeAssets: assets.length,
      sites: sites.length,
      siteNames: sites,
      assetTypes,
      maxFreshnessAgeMinutes: maxFreshnessAge,
    },
    incidents: {
      openTotal: incidents.length,
      critical,
      high,
      medium,
      maxRisk,
      top: incidents.slice(0, 8).map((item) => ({
        id: item.id,
        title: item.title,
        severity: item.severity,
        riskScore: item.riskScore,
        blastRadius: item.blastRadius,
        site: item.site,
        assetName: item.assetName,
        assetType: item.assetType,
        status: item.status,
      })),
    },
    notifications: {
      nocHealthScore: notifications.nocHealthScore,
      state: notifications.state,
      burnState: notifications.burnState,
      burnRate1h: notifications.windows.h1.burnRate,
      errorBudget24h: notifications.windows.h24.errorBudgetRemaining,
      automationEnabled: automationConfig?.enabled ?? false,
      automationLastSuccessAt: automationConfig?.lastSuccessAt ?? null,
    },
    slo: {
      latestSnapshotAt: latestSnapshot?.capturedAt ?? null,
      overallState: latestSnapshot?.overallState ?? null,
      nocHealthScore: latestSnapshot?.nocHealthScore ?? null,
      deliverySuccess24h: latestSnapshot?.deliverySuccess24h ?? null,
      retryRate24h: latestSnapshot?.retryRate24h ?? null,
      errorBudget24h: latestSnapshot?.errorBudget24h ?? null,
      burnRate1h: latestSnapshot?.burnRate1h ?? null,
    },
  };
}
