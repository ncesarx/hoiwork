import { prisma } from "@/lib/prisma";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type Dependent = {
  externalId: string;
  name: string;
  assetType: string;
  status: string;
};

function riskLevel(score: number): RiskLevel {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

function isHealthy(status: string) {
  return ["ONLINE", "RUNNING", "HEALTHY", "AVAILABLE"].includes(status);
}

function weight(assetType: string) {
  if (assetType === "VM") return 8;
  if (assetType === "LXC") return 6;
  if (assetType === "STORAGE") return 5;
  if (assetType === "NETWORK") return 3;
  return 1;
}

export async function buildImpactIntelligence(organizationId: string) {
  const [instances, assets] = await Promise.all([
    prisma.proxmoxInstance.findMany({
      where: { organizationId, enabled: true },
      orderBy: [{ site: "asc" }, { name: "asc" }],
    }),
    prisma.infrastructureAsset.findMany({
      where: {
        organizationId,
        provider: "PROXMOX",
        active: true,
        externalId: { startsWith: "proxmox/" },
      },
      orderBy: [{ assetType: "asc" }, { name: "asc" }],
    }),
  ]);

  const sites = instances.map((instance) => {
    const prefix = `proxmox/${instance.id}/`;
    const scoped = assets.filter((asset) => asset.externalId.startsWith(prefix));
    const nodes = scoped.filter((asset) => asset.assetType === "NODE");

    const nodeImpacts = nodes.map((node) => {
      const directDependents: Dependent[] = scoped
        .filter((asset) => asset.parentExternalId === node.externalId)
        .map((asset) => ({
          externalId: asset.externalId,
          name: asset.name,
          assetType: asset.assetType,
          status: asset.status,
        }));

      const unhealthy = directDependents.filter(
        (asset) => !isHealthy(asset.status),
      );

      let score = directDependents.reduce(
        (sum, asset) => sum + weight(asset.assetType),
        0,
      );

      score += unhealthy.length * 7;
      if (!isHealthy(node.status)) score += 25;
      if (instance.status !== "HEALTHY") score += 20;

      score = Math.min(100, score);

      return {
        externalId: node.externalId,
        name: node.name,
        status: node.status,
        site: instance.site,
        instanceId: instance.id,
        instanceName: instance.name,
        blastRadius: directDependents.length,
        unhealthyDependents: unhealthy.length,
        score,
        risk: riskLevel(score),
        dependents: directDependents,
      };
    });

    const siteScore = Math.min(
      100,
      Math.round(
        nodeImpacts.reduce((sum, item) => sum + item.score, 0) /
          Math.max(nodeImpacts.length, 1),
      ) + (instance.status !== "HEALTHY" ? 15 : 0),
    );

    return {
      instance: {
        id: instance.id,
        name: instance.name,
        site: instance.site,
        baseUrl: instance.baseUrl,
        status: instance.status,
        lastSyncAt: instance.lastSyncAt,
      },
      score: siteScore,
      risk: riskLevel(siteScore),
      nodes: nodeImpacts,
      counts: {
        nodes: nodes.length,
        dependents: nodeImpacts.reduce((sum, item) => sum + item.blastRadius, 0),
        unhealthy: nodeImpacts.reduce(
          (sum, item) => sum + item.unhealthyDependents,
          0,
        ),
      },
    };
  });

  const allNodes = sites.flatMap((site) => site.nodes);
  const critical = allNodes.filter((node) => node.risk === "CRITICAL").length;
  const high = allNodes.filter((node) => node.risk === "HIGH").length;

  return {
    sites,
    totals: {
      sites: sites.length,
      nodes: allNodes.length,
      dependencies: allNodes.reduce((sum, node) => sum + node.blastRadius, 0),
      unhealthyDependencies: allNodes.reduce(
        (sum, node) => sum + node.unhealthyDependents,
        0,
      ),
      criticalNodes: critical,
      highRiskNodes: high,
    },
  };
}

export async function getAssetImpact(
  organizationId: string,
  externalId: string,
) {
  const intelligence = await buildImpactIntelligence(organizationId);

  for (const site of intelligence.sites) {
    const node = site.nodes.find((item) => item.externalId === externalId);
    if (node) {
      return {
        found: true,
        site: site.instance,
        node,
      };
    }
  }

  return { found: false };
}
