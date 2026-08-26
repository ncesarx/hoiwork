import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type RecurrenceOptions = {
  source?: "MANUAL" | "DISCOVERY";
  postRemediationOnly?: boolean;
  discoveryAutomationRunId?: string | null;
  freshnessMaxMinutes?: number;
};

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

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function ageMinutes(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

export async function runIncidentRecurrenceDetection(
  organizationId: string,
  options: RecurrenceOptions = {},
) {
  const source = options.source ?? "MANUAL";
  const postRemediationOnly = Boolean(options.postRemediationOnly);
  const freshnessMaxMinutes = Math.max(1, options.freshnessMaxMinutes ?? 15);

  const resolved = await prisma.infrastructureIncident.findMany({
    where: {
      organizationId,
      status: "RESOLVED",
      resolvedAt: { not: null },
    },
    orderBy: { resolvedAt: "desc" },
    take: 500,
  });

  let inspected = 0;
  let candidates = 0;
  let created = 0;
  let skippedOpenExists = 0;
  let skippedHealthy = 0;
  let skippedNoAsset = 0;
  let skippedNotManagedClosure = 0;
  let skippedStale = 0;
  let skippedBeforeResolution = 0;

  const createdIncidents: Array<{
    id: string;
    previousIncidentId: string;
    assetName: string;
    assetStatus: string;
    recurrenceCount: number;
  }> = [];

  for (const previous of resolved) {
    inspected += 1;

    const previousMetadata = jsonObject(previous.metadata);

    const managedClosure =
      previousMetadata.postRemediationClosureDecision === "AUTO_CLOSED" &&
      previousMetadata.postRemediationClosureVersion === "015.6.11.6.4.3";

    if (postRemediationOnly && !managedClosure) {
      skippedNotManagedClosure += 1;
      continue;
    }

    const asset = await prisma.infrastructureAsset.findFirst({
      where: {
        organizationId,
        externalId: previous.assetExternalId,
      },
      orderBy: { lastSeenAt: "desc" },
    });

    if (!asset) {
      skippedNoAsset += 1;
      continue;
    }

    const evidenceAt =
      asset.lastChangedAt > asset.lastSeenAt
        ? asset.lastChangedAt
        : asset.lastSeenAt;

    if (!previous.resolvedAt || evidenceAt <= previous.resolvedAt) {
      skippedBeforeResolution += 1;
      continue;
    }

    if (ageMinutes(evidenceAt) > freshnessMaxMinutes) {
      skippedStale += 1;
      continue;
    }

    if (!unhealthy(asset.assetType, asset.status)) {
      skippedHealthy += 1;
      continue;
    }

    candidates += 1;

    const alreadyOpen = await prisma.infrastructureIncident.findFirst({
      where: {
        organizationId,
        assetExternalId: previous.assetExternalId,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
      orderBy: { firstSeenAt: "desc" },
    });

    if (alreadyOpen) {
      skippedOpenExists += 1;
      continue;
    }

    const previousRecurrenceCount =
      typeof previousMetadata.recurrenceCount === "number"
        ? Number(previousMetadata.recurrenceCount)
        : 0;

    const recurrenceCount = previousRecurrenceCount + 1;
    const now = new Date();

    const fingerprint = sha256(
      [
        organizationId,
        previous.assetExternalId,
        previous.id,
        asset.status,
        evidenceAt.toISOString(),
        String(recurrenceCount),
        "015.6.11.6.4.4",
      ].join("|"),
    );

    const externalId =
      `${previous.externalId}:recurrence:${recurrenceCount}:` +
      `${evidenceAt.getTime()}`;

    const incident = await prisma.$transaction(async (tx) => {
      const freshOpen = await tx.infrastructureIncident.findFirst({
        where: {
          organizationId,
          assetExternalId: previous.assetExternalId,
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
        },
      });

      if (freshOpen) {
        return null;
      }

      const createdIncident = await tx.infrastructureIncident.create({
        data: {
          organizationId,
          externalId,
          title: previous.title,
          description:
            `Regressão pós-fechamento detectada após resolução do incidente ${previous.id}. ` +
            `Estado atual do ativo: ${asset.status}.`,
          source: "HOIWORK_RECURRENCE",
          status: "OPEN",
          severity: previous.severity,
          riskScore: previous.riskScore,
          assetExternalId: previous.assetExternalId,
          assetName: previous.assetName,
          assetType: previous.assetType,
          instanceId: previous.instanceId,
          instanceName: previous.instanceName,
          site: previous.site,
          blastRadius: previous.blastRadius,
          fingerprint,
          firstSeenAt: evidenceAt,
          lastSeenAt: evidenceAt,
          metadata: {
            recurrenceOfIncidentId: previous.id,
            recurrenceOfExternalId: previous.externalId,
            recurrenceCount,
            previousResolvedAt: previous.resolvedAt?.toISOString() ?? null,
            recurrenceDetectedAt: now.toISOString(),
            recurrenceAssetStatus: asset.status,
            recurrenceAssetLastSeenAt: asset.lastSeenAt.toISOString(),
            recurrenceEvidenceAt: evidenceAt.toISOString(),
            recurrenceAssetLastChangedAt: asset.lastChangedAt.toISOString(),
            recurrenceSource: source,
            postClosureRegression: managedClosure,
            discoveryAutomationRunId:
              options.discoveryAutomationRunId ?? null,
            detectorVersion: "015.6.11.6.4.4",
          },
        },
      });

      await tx.infrastructureIncidentEvent.create({
        data: {
          organizationId,
          incidentId: createdIncident.id,
          eventType: "INCIDENT_RECURRENCE_OPENED",
          message:
            `Novo incidente aberto por regressão do incidente ${previous.id}. ` +
            `Ativo ${asset.name} observado em ${asset.status}.`,
          actorName: "HOIWORK",
          metadata: {
            previousIncidentId: previous.id,
            recurrenceCount,
            assetExternalId: asset.externalId,
            assetStatus: asset.status,
            source,
            discoveryAutomationRunId:
              options.discoveryAutomationRunId ?? null,
            version: "015.6.11.6.4.4",
          },
        },
      });

      await tx.infrastructureIncidentEvent.create({
        data: {
          organizationId,
          incidentId: previous.id,
          eventType: "POST_CLOSURE_REGRESSION_DETECTED",
          message:
            `Regressão pós-fechamento detectada. Novo incidente ${createdIncident.id} aberto.`,
          actorName: "HOIWORK",
          fromStatus: "RESOLVED",
          toStatus: "RESOLVED",
          metadata: {
            newIncidentId: createdIncident.id,
            recurrenceCount,
            assetStatus: asset.status,
            source,
            discoveryAutomationRunId:
              options.discoveryAutomationRunId ?? null,
            previousIncidentRemainsResolved: true,
            version: "015.6.11.6.4.4",
          },
        },
      });

      return createdIncident;
    });

    if (!incident) {
      skippedOpenExists += 1;
      continue;
    }

    created += 1;
    createdIncidents.push({
      id: incident.id,
      previousIncidentId: previous.id,
      assetName: incident.assetName,
      assetStatus: asset.status,
      recurrenceCount,
    });
  }

  return {
    version: "015.6.11.6.4.4",
    source,
    postRemediationOnly,
    inspected,
    candidates,
    created,
    skippedOpenExists,
    skippedHealthy,
    skippedNoAsset,
    skippedNotManagedClosure,
    skippedStale,
    skippedBeforeResolution,
    createdIncidents,
  };
}
