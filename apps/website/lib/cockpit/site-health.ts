import { prisma } from "@/lib/prisma";

type SiteState = "HEALTHY" | "DEGRADED" | "CRITICAL" | "NO_DATA";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function stateFromScore(score: number | null): SiteState {
  if (score === null) return "NO_DATA";
  if (score >= 90) return "HEALTHY";
  if (score >= 70) return "DEGRADED";
  return "CRITICAL";
}

function ageMinutes(date: Date | null) {
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

export async function buildSiteHealth(organizationId: string) {
  const [instances, assets, incidents] = await Promise.all([
    prisma.proxmoxInstance.findMany({
      where: { organizationId },
      orderBy: [{ site: "asc" }, { name: "asc" }],
    }),
    prisma.infrastructureAsset.findMany({
      where: { organizationId, active: true },
      select: {
        id: true,
        provider: true,
        assetType: true,
        name: true,
        clusterName: true,
        nodeName: true,
        status: true,
        externalId: true,
        lastSeenAt: true,
      },
      orderBy: [{ clusterName: "asc" }, { assetType: "asc" }, { name: "asc" }],
    }),
    prisma.infrastructureIncident.findMany({
      where: {
        organizationId,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
      orderBy: [{ riskScore: "desc" }, { lastSeenAt: "desc" }],
    }),
  ]);

  const siteKeys = Array.from(
    new Set(
      instances.map((instance) => instance.site?.trim() || "SEM_SITE"),
    ),
  );

  return siteKeys.map((siteKey) => {
    const siteInstances = instances.filter(
      (instance) => (instance.site?.trim() || "SEM_SITE") === siteKey,
    );

    const instanceNames = new Set(siteInstances.map((instance) => instance.name));
    const clusterNames = new Set(
      siteInstances.map((instance) => instance.name).filter(Boolean),
    );

    const siteAssets = assets.filter((asset) => {
      if (asset.clusterName && clusterNames.has(asset.clusterName)) return true;
      if (asset.nodeName && instanceNames.has(asset.nodeName)) return true;
      return false;
    });

    const siteIncidents = incidents.filter(
      (incident) =>
        (incident.site?.trim() || "SEM_SITE") === siteKey ||
        (incident.instanceName && instanceNames.has(incident.instanceName)),
    );

    const healthyInstances = siteInstances.filter(
      (instance) =>
        instance.status === "HEALTHY" || instance.status === "ONLINE",
    ).length;

    const instanceScore = siteInstances.length
      ? Math.round((healthyInstances / siteInstances.length) * 100)
      : null;

    const critical = siteIncidents.filter(
      (incident) => incident.severity === "CRITICAL",
    ).length;
    const high = siteIncidents.filter(
      (incident) => incident.severity === "HIGH",
    ).length;
    const medium = siteIncidents.filter(
      (incident) => incident.severity === "MEDIUM",
    ).length;

    const incidentPenalty = critical * 20 + high * 8 + medium * 2;
    const incidentScore = clamp(100 - incidentPenalty);

    const freshnessAges = siteInstances
      .map((instance) => ageMinutes(instance.lastSyncAt ?? instance.lastHealthAt))
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

    const scoreParts = [instanceScore, incidentScore, freshnessScore].filter(
      (value): value is number => value !== null,
    );

    const siteScore = scoreParts.length
      ? Math.round(scoreParts.reduce((a, b) => a + b, 0) / scoreParts.length)
      : null;

    const assetTypes = siteAssets.reduce<Record<string, number>>((acc, asset) => {
      acc[asset.assetType] = (acc[asset.assetType] ?? 0) + 1;
      return acc;
    }, {});

    return {
      site: siteKey === "SEM_SITE" ? null : siteKey,
      displayName: siteKey === "SEM_SITE" ? "Sem site definido" : siteKey,
      state: stateFromScore(siteScore),
      siteScore,
      infrastructure: {
        instances: siteInstances.length,
        healthyInstances,
        assets: siteAssets.length,
        assetTypes,
        maxFreshnessAgeMinutes: maxFreshnessAge,
      },
      incidents: {
        total: siteIncidents.length,
        critical,
        high,
        medium,
        maxRisk: siteIncidents.length
          ? Math.max(...siteIncidents.map((incident) => incident.riskScore))
          : 0,
      },
      instances: siteInstances.map((instance) => ({
        id: instance.id,
        name: instance.name,
        site: instance.site,
        status: instance.status,
        lastHealthAt: instance.lastHealthAt,
        lastSyncAt: instance.lastSyncAt,
        lastError: instance.lastError,
      })),
      topIncidents: siteIncidents.slice(0, 5).map((incident) => ({
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        riskScore: incident.riskScore,
        assetName: incident.assetName,
        assetType: incident.assetType,
        status: incident.status,
      })),
    };
  });
}
