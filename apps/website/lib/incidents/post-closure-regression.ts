import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function jsonObject(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, Prisma.JsonValue>;
  }
  return value as Record<string, Prisma.JsonValue>;
}

function unhealthy(assetType: string, status: string) {
  const type = assetType.trim().toUpperCase();
  const state = status.trim().toUpperCase();

  if (type === "VM") {
    return ["STOPPED", "OFFLINE", "ERROR", "FAILED", "MISSING"].includes(state);
  }

  if (type === "NODE") {
    return ["OFFLINE", "ERROR", "FAILED", "UNKNOWN", "MISSING"].includes(state);
  }

  if (["NETWORK", "NIC", "INTERFACE"].includes(type)) {
    return ["OFFLINE", "DOWN", "ERROR", "FAILED", "MISSING"].includes(state);
  }

  return ["OFFLINE", "DOWN", "STOPPED", "ERROR", "FAILED", "MISSING"].includes(state);
}

function ageMinutes(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

export async function buildPostClosureRegressionStatus(
  organizationId: string,
  incidentId: string,
) {
  const incident = await prisma.infrastructureIncident.findFirst({
    where: { id: incidentId, organizationId },
  });

  if (!incident) return null;

  const metadata = jsonObject(incident.metadata);
  const managedClosure =
    metadata.postRemediationClosureDecision === "AUTO_CLOSED" &&
    metadata.postRemediationClosureVersion === "015.6.11.6.4.3";

  const asset = await prisma.infrastructureAsset.findFirst({
    where: {
      organizationId,
      externalId: incident.assetExternalId,
    },
    orderBy: { lastSeenAt: "desc" },
  });

  const recurrence = await prisma.infrastructureIncident.findFirst({
    where: {
      organizationId,
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
      assetExternalId: incident.assetExternalId,
    },
    orderBy: { firstSeenAt: "desc" },
  });

  const evidenceAt = asset
    ? asset.lastChangedAt > asset.lastSeenAt
      ? asset.lastChangedAt
      : asset.lastSeenAt
    : null;

  const regressionDetected =
    incident.status === "RESOLVED" &&
    Boolean(incident.resolvedAt) &&
    Boolean(asset) &&
    Boolean(evidenceAt) &&
    evidenceAt! > incident.resolvedAt! &&
    ageMinutes(evidenceAt!) <= 15 &&
    unhealthy(asset!.assetType, asset!.status);

  let monitoringState = "NOT_APPLICABLE";

  if (managedClosure && incident.status === "RESOLVED") {
    if (recurrence) {
      monitoringState = "RECURRENCE_OPEN";
    } else if (regressionDetected) {
      monitoringState = "REGRESSION_DETECTED";
    } else {
      monitoringState = "CLOSED_STABLE";
    }
  }

  return {
    version: "015.6.11.6.4.4",
    incidentId: incident.id,
    incidentStatus: incident.status,
    managedClosure,
    monitoringState,
    regressionDetected,
    asset: asset
      ? {
          id: asset.id,
          name: asset.name,
          status: asset.status,
          active: asset.active,
          lastSeenAt: asset.lastSeenAt,
          lastChangedAt: asset.lastChangedAt,
          evidenceAt,
          freshnessMinutes: evidenceAt ? ageMinutes(evidenceAt) : null,
        }
      : null,
    recurrence: recurrence
      ? {
          id: recurrence.id,
          status: recurrence.status,
          source: recurrence.source,
          firstSeenAt: recurrence.firstSeenAt,
        }
      : null,
  };
}
