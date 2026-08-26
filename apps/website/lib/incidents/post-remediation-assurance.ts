import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AssuranceState =
  | "INSUFFICIENT_EVIDENCE"
  | "RECOVERY_OBSERVED"
  | "RECOVERY_VERIFIED";

type Check = {
  key: string;
  pass: boolean;
  weight: number;
  detail: string;
};

function jsonObject(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, Prisma.JsonValue>;
  }
  return value as Record<string, Prisma.JsonValue>;
}

function expectedStateFor(action: string) {
  switch (action) {
    case "START_VM":
      return "RUNNING";
    default:
      return null;
  }
}

function freshnessMinutes(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

export async function buildPostRemediationAssurance(
  organizationId: string,
  incidentId: string,
) {
  const incident = await prisma.infrastructureIncident.findFirst({
    where: { id: incidentId, organizationId },
  });

  if (!incident) return null;

  const plan = await prisma.remediationExecutionPlan.findFirst({
    where: {
      organizationId,
      incidentId,
      status: "APPROVED",
    },
    orderBy: { approvedAt: "desc" },
  });

  const execution = plan
    ? await prisma.remediationExecutionRun.findFirst({
        where: {
          organizationId,
          incidentId,
          planId: plan.id,
          mode: "REAL",
        },
        orderBy: { startedAt: "desc" },
      })
    : null;

  const verification =
    plan && execution
      ? await prisma.remediationVerificationRun.findFirst({
          where: {
            organizationId,
            incidentId,
            planId: plan.id,
            executionRunId: execution.id,
            status: "COMPLETED",
          },
          orderBy: { startedAt: "desc" },
        })
      : null;

  const authorization =
    plan && execution
      ? await prisma.remediationExecutionAuthorization.findFirst({
          where: {
            organizationId,
            incidentId,
            planId: plan.id,
            status: "CONSUMED",
            consumedAt: { not: null },
          },
          orderBy: { consumedAt: "desc" },
        })
      : null;

  const asset = await prisma.infrastructureAsset.findFirst({
    where: {
      organizationId,
      externalId: incident.assetExternalId,
    },
    orderBy: { lastSeenAt: "desc" },
  });

  const expectedState = plan ? expectedStateFor(plan.action) : null;
  const executionResult = jsonObject(execution?.result ?? null);
  const mutationPerformed = executionResult.mutationPerformed === true;
  const assetFreshnessMinutes = asset ? freshnessMinutes(asset.lastSeenAt) : null;
  const assetFresh = assetFreshnessMinutes !== null && assetFreshnessMinutes <= 15;

  const checks: Check[] = [
    {
      key: "PLAN_PRESENT",
      pass: Boolean(plan),
      weight: 5,
      detail: plan ? `${plan.action}:${plan.status}` : "plan-not-found",
    },
    {
      key: "EXECUTION_REAL_COMPLETED",
      pass: execution?.mode === "REAL" && execution.status === "COMPLETED",
      weight: 20,
      detail: execution
        ? `${execution.mode}:${execution.status}:${execution.executor}`
        : "execution-not-found",
    },
    {
      key: "EXECUTION_MUTATION_CONFIRMED",
      pass: mutationPerformed,
      weight: 10,
      detail: `mutationPerformed=${mutationPerformed}`,
    },
    {
      key: "AUTHORIZATION_CONSUMED",
      pass: Boolean(authorization?.consumedAt),
      weight: 10,
      detail: authorization
        ? `${authorization.status}:${authorization.consumedAt?.toISOString() ?? "null"}`
        : "authorization-not-found",
    },
    {
      key: "ASSET_FOUND",
      pass: Boolean(asset),
      weight: 10,
      detail: asset ? `${asset.assetType}:${asset.name}` : "asset-not-found",
    },
    {
      key: "ASSET_ACTIVE",
      pass: asset?.active === true,
      weight: 10,
      detail: `active=${asset?.active ?? null}`,
    },
    {
      key: "ASSET_EXPECTED_STATE",
      pass:
        Boolean(asset) &&
        Boolean(expectedState) &&
        asset!.status.toUpperCase() === expectedState,
      weight: 15,
      detail: `expected=${expectedState ?? "N/A"},observed=${asset?.status ?? "NO_DATA"}`,
    },
    {
      key: "ASSET_FRESH",
      pass: assetFresh,
      weight: 5,
      detail:
        assetFreshnessMinutes === null
          ? "NO_DATA"
          : `${assetFreshnessMinutes} minute(s)`,
    },
    {
      key: "VERIFICATION_COMPLETED",
      pass: verification?.status === "COMPLETED",
      weight: 5,
      detail: verification?.status ?? "verification-not-found",
    },
    {
      key: "VERIFICATION_VERIFIED",
      pass: verification?.verificationState === "VERIFIED",
      weight: 10,
      detail: verification?.verificationState ?? "verification-not-found",
    },
  ];

  const confidenceScore = checks.reduce(
    (sum, check) => sum + (check.pass ? check.weight : 0),
    0,
  );

  const recoveryObserved =
    execution?.status === "COMPLETED" &&
    mutationPerformed &&
    asset?.active === true &&
    Boolean(expectedState) &&
    asset.status.toUpperCase() === expectedState &&
    assetFresh;

  const recoveryVerified =
    recoveryObserved &&
    verification?.status === "COMPLETED" &&
    verification.verificationState === "VERIFIED";

  let assuranceState: AssuranceState = "INSUFFICIENT_EVIDENCE";
  if (recoveryVerified) {
    assuranceState = "RECOVERY_VERIFIED";
  } else if (recoveryObserved) {
    assuranceState = "RECOVERY_OBSERVED";
  }

  const closureBlockers: string[] = [];

  if (!execution || execution.status !== "COMPLETED") {
    closureBlockers.push("EXECUTION_NOT_COMPLETED");
  }
  if (!mutationPerformed) {
    closureBlockers.push("MUTATION_NOT_CONFIRMED");
  }
  if (!asset) {
    closureBlockers.push("ASSET_NOT_FOUND");
  } else {
    if (!asset.active) closureBlockers.push("ASSET_INACTIVE");
    if (!assetFresh) closureBlockers.push("ASSET_STALE");
    if (expectedState && asset.status.toUpperCase() !== expectedState) {
      closureBlockers.push("EXPECTED_STATE_NOT_OBSERVED");
    }
  }
  if (!verification) {
    closureBlockers.push("VERIFICATION_MISSING");
  } else if (verification.verificationState !== "VERIFIED") {
    closureBlockers.push("VERIFICATION_NOT_VERIFIED");
  }

  // 6.4.1 never closes incidents. Stability policy belongs to 6.4.2+.
  closureBlockers.push("STABILITY_WINDOW_NOT_EVALUATED");
  closureBlockers.push("AUTO_CLOSURE_NOT_ENABLED_IN_6_4_1");

  const legacyResolutionDetected =
    incident.status === "RESOLVED" &&
    incident.resolvedAt !== null &&
    !recoveryVerified;

  const warnings: string[] = [];
  if (legacyResolutionDetected) {
    warnings.push("LEGACY_RECONCILIATION_RESOLVED_BEFORE_ASSURANCE");
  }
  if (incident.status === "RESOLVED" && !verification) {
    warnings.push("INCIDENT_RESOLVED_WITHOUT_VERIFICATION");
  }

  return {
    version: "015.6.11.6.4.1",
    generatedAt: new Date(),
    incident: {
      id: incident.id,
      status: incident.status,
      resolvedAt: incident.resolvedAt,
      assetExternalId: incident.assetExternalId,
      assetName: incident.assetName,
    },
    plan: plan
      ? {
          id: plan.id,
          action: plan.action,
          status: plan.status,
          approvedAt: plan.approvedAt,
          executedAt: plan.executedAt,
        }
      : null,
    execution: execution
      ? {
          id: execution.id,
          mode: execution.mode,
          status: execution.status,
          executor: execution.executor,
          startedAt: execution.startedAt,
          finishedAt: execution.finishedAt,
          mutationPerformed,
        }
      : null,
    authorization: authorization
      ? {
          id: authorization.id,
          status: authorization.status,
          consumedAt: authorization.consumedAt,
        }
      : null,
    verification: verification
      ? {
          id: verification.id,
          status: verification.status,
          verificationState: verification.verificationState,
          expectedState: verification.expectedState,
          observedState: verification.observedState,
          startedAt: verification.startedAt,
          finishedAt: verification.finishedAt,
        }
      : null,
    asset: asset
      ? {
          id: asset.id,
          externalId: asset.externalId,
          status: asset.status,
          active: asset.active,
          nodeName: asset.nodeName,
          uptimeSeconds: asset.uptimeSeconds,
          lastSeenAt: asset.lastSeenAt,
          lastChangedAt: asset.lastChangedAt,
          freshnessMinutes: assetFreshnessMinutes,
        }
      : null,
    expectedState,
    checks,
    confidenceScore,
    assuranceState,
    recoveryObserved,
    recoveryVerified,
    closureEligible: false,
    closureBlockers,
    warnings,
    legacyResolutionDetected,
  };
}
