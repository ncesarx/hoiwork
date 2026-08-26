import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { buildImpactIntelligence } from "@/lib/discovery/impact-intelligence";

function healthy(status: string) {
  return ["ONLINE", "RUNNING", "HEALTHY", "AVAILABLE"].includes(status);
}

function severity(score: number) {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

function fingerprint(parts: string[]) {
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

export async function correlateInfrastructureIncidents(organizationId: string) {
  const [intelligence, assets] = await Promise.all([
    buildImpactIntelligence(organizationId),
    prisma.infrastructureAsset.findMany({
      where: {
        organizationId,
        provider: "PROXMOX",
        active: true,
        externalId: { startsWith: "proxmox/" },
      },
    }),
  ]);

  const candidates: Array<{
    assetExternalId: string;
    assetName: string;
    assetType: string;
    status: string;
    instanceId?: string;
    instanceName?: string;
    site?: string | null;
    blastRadius: number;
    riskScore: number;
    severity: string;
  }> = [];

  for (const site of intelligence.sites) {
    for (const node of site.nodes) {
      if (!healthy(node.status) || node.unhealthyDependents > 0) {
        candidates.push({
          assetExternalId: node.externalId,
          assetName: node.name,
          assetType: "NODE",
          status: node.status,
          instanceId: site.instance.id,
          instanceName: site.instance.name,
          site: site.instance.site,
          blastRadius: node.blastRadius,
          riskScore: node.score,
          severity: node.risk,
        });
      }
    }
  }

  for (const asset of assets) {
    if (asset.assetType === "NODE" || healthy(asset.status)) continue;
    const metadata =
      asset.metadata && typeof asset.metadata === "object" && !Array.isArray(asset.metadata)
        ? (asset.metadata as Record<string, unknown>)
        : {};

    let score = asset.assetType === "VM" ? 45 :
      asset.assetType === "LXC" ? 40 :
      asset.assetType === "STORAGE" ? 55 :
      asset.assetType === "NETWORK" ? 50 : 25;

    if (["MISSING", "OFFLINE", "ERROR"].includes(asset.status)) score += 20;
    score = Math.min(100, score);

    candidates.push({
      assetExternalId: asset.externalId,
      assetName: asset.name,
      assetType: asset.assetType,
      status: asset.status,
      instanceId: typeof metadata.proxmoxInstanceId === "string" ? metadata.proxmoxInstanceId : undefined,
      instanceName: typeof metadata.proxmoxInstanceName === "string" ? metadata.proxmoxInstanceName : undefined,
      site: typeof metadata.proxmoxSite === "string" ? metadata.proxmoxSite : undefined,
      blastRadius: 0,
      riskScore: score,
      severity: severity(score),
    });
  }

  const now = new Date();
  const activeFingerprints: string[] = [];
  let opened = 0;
  let updated = 0;

  for (const item of candidates) {
    const fp = fingerprint(["PROXMOX", item.assetExternalId, "UNHEALTHY"]);
    activeFingerprints.push(fp);

    const existing = await prisma.infrastructureIncident.findUnique({
      where: {
        organizationId_fingerprint: {
          organizationId,
          fingerprint: fp,
        },
      },
    });

    await prisma.infrastructureIncident.upsert({
      where: {
        organizationId_fingerprint: {
          organizationId,
          fingerprint: fp,
        },
      },
      update: {
        title: `${item.assetType} ${item.assetName} requer atenção`,
        description: `Estado atual: ${item.status}. Impacto calculado pelo Digital Twin.`,
        status: "OPEN",
        severity: item.severity,
        riskScore: item.riskScore,
        assetName: item.assetName,
        assetType: item.assetType,
        instanceId: item.instanceId,
        instanceName: item.instanceName,
        site: item.site,
        blastRadius: item.blastRadius,
        lastSeenAt: now,
        resolvedAt: null,
        metadata: {
          observedStatus: item.status,
          correlationVersion: "015.6.6",
        },
      },
      create: {
        organizationId,
        externalId: `incident/${fp.slice(0, 16)}`,
        title: `${item.assetType} ${item.assetName} requer atenção`,
        description: `Estado atual: ${item.status}. Impacto calculado pelo Digital Twin.`,
        source: "HOIWORK",
        status: "OPEN",
        severity: item.severity,
        riskScore: item.riskScore,
        assetExternalId: item.assetExternalId,
        assetName: item.assetName,
        assetType: item.assetType,
        instanceId: item.instanceId,
        instanceName: item.instanceName,
        site: item.site,
        blastRadius: item.blastRadius,
        fingerprint: fp,
        firstSeenAt: now,
        lastSeenAt: now,
        metadata: {
          observedStatus: item.status,
          correlationVersion: "015.6.6",
        },
      },
    });

    existing ? updated++ : opened++;
  }

  const resolved = await prisma.infrastructureIncident.updateMany({
    where: {
      organizationId,
      source: "HOIWORK",
      status: "OPEN",
      ...(activeFingerprints.length ? { fingerprint: { notIn: activeFingerprints } } : {}),
    },
    data: {
      status: "RESOLVED",
      resolvedAt: now,
      lastSeenAt: now,
    },
  });

  return {
    candidates: candidates.length,
    opened,
    updated,
    resolved: resolved.count,
    activeFingerprints: activeFingerprints.length,
  };
}
