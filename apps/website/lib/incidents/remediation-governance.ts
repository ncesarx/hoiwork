import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SessionLike = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
};

type GovernanceDecision =
  | "DENY"
  | "SIMULATION_ONLY"
  | "REAL_EXECUTION_ELIGIBLE";

function actor(session: SessionLike) {
  return {
    id: session.user.id,
    name: session.user.name ?? session.user.email ?? "Operador",
  };
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function envTrue(name: string, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function minutesSince(value: Date | null) {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / 60000));
}

const REAL_ACTION_ALLOWLIST = new Set(["START_VM"]);
const REAL_SAFETY_ALLOWLIST = new Set([
  "APPROVAL_REQUIRED",
  "AUTOMATION_ELIGIBLE",
]);

export async function evaluateRemediationGovernance(input: {
  organizationId: string;
  incidentId: string;
  planId: string;
  session: SessionLike;
}) {
  const plan = await prisma.remediationExecutionPlan.findFirst({
    where: {
      id: input.planId,
      organizationId: input.organizationId,
      incidentId: input.incidentId,
    },
    include: {
      incident: true,
    },
  });

  if (!plan) throw new Error("Plano não encontrado.");

  const asset = await prisma.infrastructureAsset.findFirst({
    where: {
      organizationId: input.organizationId,
      externalId: plan.incident.assetExternalId,
    },
    orderBy: { lastSeenAt: "desc" },
  });

  const [runningExecutions, recentFailures] = await Promise.all([
    prisma.remediationExecutionRun.count({
      where: {
        organizationId: input.organizationId,
        planId: plan.id,
        status: "RUNNING",
      },
    }),
    prisma.remediationExecutionRun.count({
      where: {
        organizationId: input.organizationId,
        status: "FAILED",
        startedAt: {
          gte: new Date(Date.now() - 30 * 60 * 1000),
        },
      },
    }),
  ]);

  const approvalAgeMinutes = minutesSince(plan.approvedAt);
  const maxApprovalAgeMinutes = Number(
    process.env.HOIWORK_REMEDIATION_APPROVAL_MAX_AGE_MINUTES ?? "60",
  );

  const policyEnabled = envTrue(
    "HOIWORK_REAL_REMEDIATION_POLICY_ENABLED",
    false,
  );
  const killSwitchActive = envTrue(
    "HOIWORK_REAL_REMEDIATION_KILL_SWITCH",
    true,
  );
  const maintenanceOpen = envTrue(
    "HOIWORK_REMEDIATION_MAINTENANCE_OPEN",
    false,
  );

  const planApproved = plan.status === "APPROVED";
  const planNotExpired = !plan.expiresAt || plan.expiresAt > new Date();
  const approvalFresh =
    approvalAgeMinutes !== null &&
    approvalAgeMinutes <= maxApprovalAgeMinutes;
  const actionAllowed = REAL_ACTION_ALLOWLIST.has(plan.action);
  const safetyAllowed = REAL_SAFETY_ALLOWLIST.has(plan.safetyClass);

  const targetValid =
    Boolean(asset) &&
    asset?.active === true &&
    asset.provider.toUpperCase() === "PROXMOX" &&
    plan.incident.assetType.toUpperCase() === "VM" &&
    Boolean(asset.nodeName);

  const noConcurrency = runningExecutions === 0;
  const circuitBreakerOpen = recentFailures >= 3;

  const checks = [
    {
      key: "PLAN_APPROVED",
      critical: true,
      pass: planApproved,
      detail: `status=${plan.status}`,
    },
    {
      key: "PLAN_NOT_EXPIRED",
      critical: true,
      pass: planNotExpired,
      detail: plan.expiresAt?.toISOString() ?? "no-expiration",
    },
    {
      key: "APPROVAL_FRESH",
      critical: true,
      pass: approvalFresh,
      detail:
        approvalAgeMinutes === null
          ? "approvedAt missing"
          : `${approvalAgeMinutes}m <= ${maxApprovalAgeMinutes}m`,
    },
    {
      key: "ACTION_ALLOWLIST",
      critical: true,
      pass: actionAllowed,
      detail: plan.action,
    },
    {
      key: "SAFETY_CLASS_ALLOWED",
      critical: true,
      pass: safetyAllowed,
      detail: plan.safetyClass,
    },
    {
      key: "TARGET_VALID",
      critical: true,
      pass: targetValid,
      detail: asset
        ? `${asset.provider}:${asset.assetType}:${asset.name}:${asset.status}`
        : "asset-not-found",
    },
    {
      key: "MAINTENANCE_POLICY",
      critical: true,
      pass: maintenanceOpen,
      detail: `HOIWORK_REMEDIATION_MAINTENANCE_OPEN=${maintenanceOpen}`,
    },
    {
      key: "NO_CONCURRENT_EXECUTION",
      critical: true,
      pass: noConcurrency,
      detail: `running=${runningExecutions}`,
    },
    {
      key: "CIRCUIT_BREAKER_CLOSED",
      critical: true,
      pass: !circuitBreakerOpen,
      detail: `failedLast30m=${recentFailures}`,
    },
    {
      key: "KILL_SWITCH_OFF",
      critical: true,
      pass: !killSwitchActive,
      detail: `killSwitchActive=${killSwitchActive}`,
    },
    {
      key: "REAL_POLICY_ENABLED",
      critical: true,
      pass: policyEnabled,
      detail: `policyEnabled=${policyEnabled}`,
    },
  ];

  const blockers = checks
    .filter((check) => check.critical && !check.pass)
    .map((check) => check.key);

  const warnings: string[] = [];

  if (plan.realExecutionEnabled) {
    warnings.push(
      "PLAN_REAL_EXECUTION_FLAG_TRUE_BUT_EXECUTOR_GATE_REMAINS_CLOSED",
    );
  }

  if (plan.executableNow) {
    warnings.push(
      "PLAN_EXECUTABLE_NOW_TRUE_BUT_GOVERNANCE_DOES_NOT_EXECUTE",
    );
  }

  let decision: GovernanceDecision = "SIMULATION_ONLY";

  if (
    !planApproved ||
    !planNotExpired ||
    !actionAllowed ||
    !safetyAllowed ||
    !targetValid ||
    !noConcurrency ||
    circuitBreakerOpen
  ) {
    decision = "DENY";
  } else if (blockers.length === 0) {
    decision = "REAL_EXECUTION_ELIGIBLE";
  }

  /*
   * CRITICAL: eligibility is classification only.
   * This sprint NEVER opens the real executor gate.
   */
  const eligibleForRealExecution =
    decision === "REAL_EXECUTION_ELIGIBLE";

  const who = actor(input.session);

  const evaluation =
    await prisma.remediationGovernanceEvaluation.create({
      data: {
        organizationId: input.organizationId,
        incidentId: input.incidentId,
        planId: plan.id,
        decision,
        policyVersion: "015.6.11.6.1",
        eligibleForRealExecution,
        realExecutionStillBlocked: true,
        checks: json(checks),
        blockers: json(blockers),
        warnings: json(warnings),
        targetAssessment: json({
          found: Boolean(asset),
          assetId: asset?.id ?? null,
          provider: asset?.provider ?? null,
          assetType: asset?.assetType ?? null,
          name: asset?.name ?? plan.incident.assetName,
          nodeName: asset?.nodeName ?? null,
          status: asset?.status ?? null,
          active: asset?.active ?? null,
          valid: targetValid,
        }),
        approvalAssessment: json({
          planStatus: plan.status,
          approvedAt: plan.approvedAt?.toISOString() ?? null,
          approvedByName: plan.approvedByName,
          approvalAgeMinutes,
          maxApprovalAgeMinutes,
          fresh: approvalFresh,
        }),
        maintenanceAssessment: json({
          source: "ENV_GOVERNANCE_FLAG",
          open: maintenanceOpen,
          failClosed: true,
        }),
        concurrencyAssessment: json({
          runningExecutions,
          pass: noConcurrency,
        }),
        circuitBreakerAssessment: json({
          failedLast30Minutes: recentFailures,
          threshold: 3,
          open: circuitBreakerOpen,
        }),
        killSwitchAssessment: json({
          active: killSwitchActive,
          defaultFailClosed: true,
        }),
        evaluatedById: who.id,
        evaluatedByName: who.name,
      },
    });

  await prisma.infrastructureIncidentEvent.create({
    data: {
      organizationId: input.organizationId,
      incidentId: input.incidentId,
      eventType: "REMEDIATION_GOVERNANCE_EVALUATED",
      message:
        `Governança avaliou ${plan.action}: ${decision}. ` +
        "Execução real permanece bloqueada.",
      actorUserId: who.id,
      actorName: who.name,
      metadata: json({
        planId: plan.id,
        governanceEvaluationId: evaluation.id,
        decision,
        eligibleForRealExecution,
        realExecutionStillBlocked: true,
        blockers,
        version: "015.6.11.6.1",
      }),
    },
  });

  return {
    evaluation,
    plan,
    asset,
    checks,
    blockers,
    warnings,
  };
}
