import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const HEALTHY_STATUSES = new Set([
  "HEALTHY",
  "ONLINE",
  "RUNNING",
  "OK",
  "UP",
]);

const FRESHNESS_MAX_MINUTES = 15;
const REQUIRED_RECOVERY_EVIDENCE = 2;

// 015.6.11.6.4.2: post-remediation stability policy.
const POST_REMEDIATION_REQUIRED_EVIDENCE = 3;

function jsonObject(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, Prisma.JsonValue>;
  }
  return value as Record<string, Prisma.JsonValue>;
}

function numberValue(value: Prisma.JsonValue | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringValue(value: Prisma.JsonValue | undefined) {
  return typeof value === "string" ? value : null;
}

function ageMinutes(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

export async function reconcileInfrastructureIncidents(input: {
  organizationId: string;
  source?: "MANUAL" | "DISCOVERY";
  commit?: boolean;
  discoveryAutomationRunId?: string;
}) {
  const source = input.source ?? "MANUAL";
  const commit = Boolean(input.commit);
  const startedAt = new Date();

  const run = await prisma.incidentReconciliationRun.create({
    data: {
      organizationId: input.organizationId,
      source,
      status: "RUNNING",
      startedAt,
      discoveryAutomationRunId: input.discoveryAutomationRunId ?? null,
    },
  });

  const incidents = await prisma.infrastructureIncident.findMany({
    where: {
      organizationId: input.organizationId,
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
    },
    orderBy: [{ riskScore: "desc" }, { lastSeenAt: "desc" }],
  });

  const incidentIds = incidents.map((incident) => incident.id);

  const completedRealExecutions =
    incidentIds.length > 0
      ? await prisma.remediationExecutionRun.findMany({
          where: {
            organizationId: input.organizationId,
            incidentId: { in: incidentIds },
            mode: "REAL",
            status: "COMPLETED",
          },
          select: {
            incidentId: true,
          },
          distinct: ["incidentId"],
        })
      : [];

  const postRemediationIncidentIds = new Set(
    completedRealExecutions.map((execution) => execution.incidentId),
  );

  const discoveryConfig = await prisma.discoveryAutomationConfig.findFirst({
    where: { organizationId: input.organizationId },
    orderBy: { updatedAt: "desc" },
  });

  const discoveryIntervalMinutes = Math.max(
    1,
    discoveryConfig?.intervalMinutes ?? 5,
  );

  // With a 5 minute cadence, three independent observations span ~10 minutes.
  const postRemediationMinimumStableSeconds = Math.max(
    600,
    discoveryIntervalMinutes * 2 * 60,
  );

  const assetIds = Array.from(
    new Set(incidents.map((incident) => incident.assetExternalId)),
  );

  const assets = await prisma.infrastructureAsset.findMany({
    where: {
      organizationId: input.organizationId,
      externalId: { in: assetIds },
    },
    orderBy: { lastSeenAt: "desc" },
  });

  const assetByExternalId = new Map(
    assets.map((asset) => [asset.externalId, asset]),
  );

  let keptOpen = 0;
  let resolved = 0;
  let skipped = 0;
  let errors = 0;
  const details: Array<Record<string, unknown>> = [];

  try {
    for (const incident of incidents) {
      const asset = assetByExternalId.get(incident.assetExternalId);

      if (!asset) {
        skipped += 1;
        details.push({
          incidentId: incident.id,
          title: incident.title,
          action: "SKIPPED",
          reason: "ASSET_NOT_FOUND",
        });
        continue;
      }

      const fresh = ageMinutes(asset.lastSeenAt) <= FRESHNESS_MAX_MINUTES;
      const healthy = HEALTHY_STATUSES.has(asset.status.toUpperCase());
      const postRemediationManaged = postRemediationIncidentIds.has(incident.id);

      if (!asset.active || !fresh) {
        skipped += 1;
        details.push({
          incidentId: incident.id,
          title: incident.title,
          asset: asset.name,
          assetStatus: asset.status,
          action: "SKIPPED",
          reason: !asset.active ? "ASSET_INACTIVE" : "ASSET_STALE",
          freshnessMinutes: ageMinutes(asset.lastSeenAt),
          postRemediationManaged,
        });
        continue;
      }

      const metadata = jsonObject(incident.metadata);
      const currentAssetSeenAt = asset.lastSeenAt.toISOString();

      /*
       * 015.6.11.6.4.2
       * Incidents with a completed REAL remediation execution leave the legacy
       * auto-resolution path. Reconciliation may collect/reset stability evidence,
       * but MUST keep the incident OPEN. Closure belongs to 6.4.3.
       */
      if (postRemediationManaged) {
        const previousEvidence = numberValue(
          metadata.postRemediationStabilityEvidenceCount,
        );

        const previousEvidenceAssetSeenAt = stringValue(
          metadata.postRemediationStabilityEvidenceAssetSeenAt,
        );

        const isNewDiscoveryEvidence =
          previousEvidenceAssetSeenAt !== currentAssetSeenAt;

        if (!healthy) {
          keptOpen += 1;

          if (commit) {
            await prisma.infrastructureIncident.update({
              where: { id: incident.id },
              data: {
                metadata: {
                  ...metadata,
                  postRemediationStabilityEvidenceCount: 0,
                  postRemediationStabilityFirstObservedAt: null,
                  postRemediationStabilityLastObservedAt:
                    new Date().toISOString(),
                  postRemediationStabilityLastAssetStatus: asset.status,
                  postRemediationStabilityEvidenceAssetSeenAt:
                    currentAssetSeenAt,
                  postRemediationClosureCandidate: false,
                  postRemediationStabilityState: "RESET",
                  postRemediationStabilityVersion: "015.6.11.6.4.2",
                } as Prisma.InputJsonValue,
              },
            });
          }

          details.push({
            incidentId: incident.id,
            title: incident.title,
            asset: asset.name,
            assetStatus: asset.status,
            action: "KEEP_OPEN",
            reason: "POST_REMEDIATION_REGRESSION",
            recoveryEvidenceCount: 0,
            postRemediationManaged: true,
          });
          continue;
        }

        const nextEvidence = isNewDiscoveryEvidence
          ? previousEvidence + 1
          : previousEvidence;

        const now = new Date();
        const firstObservedAt =
          stringValue(metadata.postRemediationStabilityFirstObservedAt) ??
          (isNewDiscoveryEvidence ? now.toISOString() : null);

        const firstObservedDate = firstObservedAt
          ? new Date(firstObservedAt)
          : null;

        const stableForSeconds = firstObservedDate
          ? Math.max(
              0,
              Math.floor(
                (asset.lastSeenAt.getTime() - firstObservedDate.getTime()) /
                  1000,
              ),
            )
          : 0;

        const stable =
          nextEvidence >= POST_REMEDIATION_REQUIRED_EVIDENCE &&
          stableForSeconds >= postRemediationMinimumStableSeconds;

        keptOpen += 1;

        if (commit) {
          await prisma.infrastructureIncident.update({
            where: { id: incident.id },
            data: {
              metadata: {
                ...metadata,
                postRemediationStabilityEvidenceCount: nextEvidence,
                postRemediationStabilityFirstObservedAt: firstObservedAt,
                postRemediationStabilityLastObservedAt: now.toISOString(),
                postRemediationStabilityLastAssetStatus: asset.status,
                postRemediationStabilityEvidenceAssetSeenAt:
                  currentAssetSeenAt,
                postRemediationClosureCandidate: stable,
                postRemediationStabilityState: stable
                  ? "RECOVERY_STABLE"
                  : "STABILITY_PENDING",
                postRemediationStableForSeconds: stableForSeconds,
                postRemediationRequiredEvidence:
                  POST_REMEDIATION_REQUIRED_EVIDENCE,
                postRemediationMinimumStableSeconds,
                postRemediationDiscoveryIntervalMinutes:
                  discoveryIntervalMinutes,
                postRemediationStabilityVersion: "015.6.11.6.4.2",
              } as Prisma.InputJsonValue,
            },
          });
        }

        details.push({
          incidentId: incident.id,
          title: incident.title,
          asset: asset.name,
          assetStatus: asset.status,
          action: "KEEP_OPEN",
          reason: stable
            ? "POST_REMEDIATION_STABLE_CLOSURE_BLOCKED"
            : isNewDiscoveryEvidence
              ? "POST_REMEDIATION_STABILITY_PENDING"
              : "WAITING_FOR_NEW_DISCOVERY_EVIDENCE",
          recoveryEvidenceCount: nextEvidence,
          requiredEvidence: POST_REMEDIATION_REQUIRED_EVIDENCE,
          stableForSeconds,
          minimumStableSeconds: postRemediationMinimumStableSeconds,
          closureCandidate: stable,
          postRemediationManaged: true,
        });

        continue;
      }

      // Legacy reconciliation path for incidents without REAL remediation.
      const previousEvidence = numberValue(metadata.recoveryEvidenceCount);
      const previousEvidenceAssetSeenAt =
        typeof metadata.recoveryEvidenceAssetSeenAt === "string"
          ? metadata.recoveryEvidenceAssetSeenAt
          : null;
      const isNewDiscoveryEvidence =
        previousEvidenceAssetSeenAt !== currentAssetSeenAt;

      if (!healthy) {
        keptOpen += 1;

        if (commit && previousEvidence !== 0) {
          await prisma.infrastructureIncident.update({
            where: { id: incident.id },
            data: {
              metadata: {
                ...metadata,
                recoveryEvidenceCount: 0,
                recoveryLastObservedAt: new Date().toISOString(),
                recoveryLastAssetStatus: asset.status,
                recoveryEvidenceAssetSeenAt: currentAssetSeenAt,
                reconciliationVersion: "015.6.11.2.1",
              } as Prisma.InputJsonValue,
            },
          });
        }

        details.push({
          incidentId: incident.id,
          title: incident.title,
          asset: asset.name,
          assetStatus: asset.status,
          action: "KEEP_OPEN",
          reason: "CONDITION_STILL_PRESENT",
          recoveryEvidenceCount: 0,
        });
        continue;
      }

      const nextEvidence = isNewDiscoveryEvidence
        ? previousEvidence + 1
        : previousEvidence;

      const canResolve =
        isNewDiscoveryEvidence &&
        nextEvidence >= REQUIRED_RECOVERY_EVIDENCE;

      if (!canResolve) {
        keptOpen += 1;

        if (commit) {
          await prisma.infrastructureIncident.update({
            where: { id: incident.id },
            data: {
              metadata: {
                ...metadata,
                recoveryEvidenceCount: nextEvidence,
                recoveryFirstObservedAt:
                  metadata.recoveryFirstObservedAt ??
                  new Date().toISOString(),
                recoveryLastObservedAt: new Date().toISOString(),
                recoveryLastAssetStatus: asset.status,
                recoveryEvidenceAssetSeenAt: currentAssetSeenAt,
                reconciliationVersion: "015.6.11.2.1",
              } as Prisma.InputJsonValue,
            },
          });
        }

        details.push({
          incidentId: incident.id,
          title: incident.title,
          asset: asset.name,
          assetStatus: asset.status,
          action: "KEEP_OPEN",
          reason: isNewDiscoveryEvidence
            ? "RECOVERY_EVIDENCE_PENDING"
            : "WAITING_FOR_NEW_DISCOVERY_EVIDENCE",
          recoveryEvidenceCount: nextEvidence,
          requiredEvidence: REQUIRED_RECOVERY_EVIDENCE,
        });
        continue;
      }

      resolved += 1;

      if (commit) {
        const now = new Date();

        await prisma.infrastructureIncident.update({
          where: { id: incident.id },
          data: {
            status: "RESOLVED",
            resolvedAt: now,
            lastSeenAt: now,
            metadata: {
              ...metadata,
              recoveryEvidenceCount: nextEvidence,
              recoveryLastObservedAt: now.toISOString(),
              recoveryLastAssetStatus: asset.status,
              recoveryEvidenceAssetSeenAt: currentAssetSeenAt,
              resolutionSource: "DISCOVERY_TRIGGERED_RECONCILIATION",
              resolutionReason:
                "Asset observed healthy in consecutive fresh discovery states.",
              reconciliationVersion: "015.6.11.2.1",
            } as Prisma.InputJsonValue,
          },
        });
      }

      details.push({
        incidentId: incident.id,
        title: incident.title,
        asset: asset.name,
        assetStatus: asset.status,
        action: commit ? "RESOLVED" : "WOULD_RESOLVE",
        reason: "RECOVERY_CONFIRMED",
        recoveryEvidenceCount: nextEvidence,
      });
    }

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    await prisma.incidentReconciliationRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        finishedAt,
        durationMs,
        inspected: incidents.length,
        keptOpen,
        resolved,
        skipped,
        errors,
        details: details as Prisma.InputJsonValue,
      },
    });

    return {
      runId: run.id,
      discoveryAutomationRunId: input.discoveryAutomationRunId ?? null,
      mode: commit ? "COMMIT" : "DRY_RUN",
      inspected: incidents.length,
      keptOpen,
      resolved,
      skipped,
      errors,
      durationMs,
      details,
    };
  } catch (error) {
    errors += 1;
    const finishedAt = new Date();
    const message =
      error instanceof Error ? error.message : "Falha na reconciliação.";

    await prisma.incidentReconciliationRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        inspected: incidents.length,
        keptOpen,
        resolved,
        skipped,
        errors,
        errorMessage: message,
        details: details as Prisma.InputJsonValue,
      },
    });

    throw error;
  }
}
