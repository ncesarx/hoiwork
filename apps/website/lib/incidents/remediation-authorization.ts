import crypto from "crypto";
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

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function bindingFingerprint(input: {
  organizationId: string;
  incidentId: string;
  planId: string;
  governanceId: string;
  action: string;
  assetExternalId: string;
}) {
  return sha256(
    [
      input.organizationId,
      input.incidentId,
      input.planId,
      input.governanceId,
      input.action,
      input.assetExternalId,
      "015.6.11.6.2",
    ].join("|"),
  );
}

export async function authorizeExecutionPreflight(input: {
  organizationId: string;
  incidentId: string;
  planId: string;
  session: SessionLike;
}) {
  if (input.session.user.role !== "ADMIN") {
    throw new Error("Somente ADMIN pode emitir autorização de execução.");
  }

  const plan = await prisma.remediationExecutionPlan.findFirst({
    where: {
      id: input.planId,
      organizationId: input.organizationId,
      incidentId: input.incidentId,
    },
    include: { incident: true },
  });

  if (!plan) throw new Error("Plano não encontrado.");

  const governance = await prisma.remediationGovernanceEvaluation.findFirst({
    where: {
      organizationId: input.organizationId,
      incidentId: input.incidentId,
      planId: input.planId,
      decision: "REAL_EXECUTION_ELIGIBLE",
      eligibleForRealExecution: true,
      realExecutionStillBlocked: true,
    },
    orderBy: { evaluatedAt: "desc" },
  });

  if (!governance) {
    throw new Error(
      "Governança REAL_EXECUTION_ELIGIBLE válida não encontrada.",
    );
  }

  const asset = await prisma.infrastructureAsset.findFirst({
    where: {
      organizationId: input.organizationId,
      externalId: plan.incident.assetExternalId,
    },
    orderBy: { lastSeenAt: "desc" },
  });

  const now = new Date();
  const ttlSeconds = Math.max(
    30,
    Math.min(
      600,
      Number(process.env.HOIWORK_EXECUTION_AUTH_TTL_SECONDS ?? "120"),
    ),
  );

  const killSwitchActive = envTrue(
    "HOIWORK_REAL_REMEDIATION_KILL_SWITCH",
    true,
  );

  const realPolicyEnabled = envTrue(
    "HOIWORK_REAL_REMEDIATION_POLICY_ENABLED",
    false,
  );

  const maintenanceOpen = envTrue(
    "HOIWORK_REMEDIATION_MAINTENANCE_OPEN",
    false,
  );

  const activeAuthorization =
    await prisma.remediationExecutionAuthorization.findFirst({
      where: {
        organizationId: input.organizationId,
        incidentId: input.incidentId,
        planId: plan.id,
        status: "AUTHORIZED",
        expiresAt: { gt: now },
        consumedAt: null,
        revokedAt: null,
      },
      orderBy: { issuedAt: "desc" },
    });

  const concurrentRun = await prisma.remediationExecutionRun.count({
    where: {
      organizationId: input.organizationId,
      incidentId: input.incidentId,
      planId: plan.id,
      status: "RUNNING",
    },
  });

  const checks = [
    {
      key: "PLAN_APPROVED",
      pass: plan.status === "APPROVED",
      detail: `status=${plan.status}`,
    },
    {
      key: "PLAN_NOT_EXPIRED",
      pass: !plan.expiresAt || plan.expiresAt > now,
      detail: plan.expiresAt?.toISOString() ?? "no-expiration",
    },
    {
      key: "GOVERNANCE_REAL_ELIGIBLE",
      pass:
        governance.decision === "REAL_EXECUTION_ELIGIBLE" &&
        governance.eligibleForRealExecution,
      detail: governance.decision,
    },
    {
      key: "GOVERNANCE_FRESH",
      pass: now.getTime() - governance.evaluatedAt.getTime() <= 5 * 60 * 1000,
      detail: governance.evaluatedAt.toISOString(),
    },
    {
      key: "ASSET_PRESENT",
      pass: Boolean(asset),
      detail: asset ? `${asset.assetType}:${asset.name}` : "asset-not-found",
    },
    {
      key: "TARGET_ACTIVE",
      pass: asset?.active === true,
      detail: `active=${asset?.active ?? null}`,
    },
    {
      key: "NODE_BOUND",
      pass: Boolean(asset?.nodeName),
      detail: asset?.nodeName ?? "node-missing",
    },
    {
      key: "KILL_SWITCH_OFF",
      pass: killSwitchActive === false,
      detail: `killSwitchActive=${killSwitchActive}`,
    },
    {
      key: "REAL_POLICY_ENABLED",
      pass: realPolicyEnabled,
      detail: `policyEnabled=${realPolicyEnabled}`,
    },
    {
      key: "MAINTENANCE_OPEN",
      pass: maintenanceOpen,
      detail: `maintenanceOpen=${maintenanceOpen}`,
    },
    {
      key: "NO_CONCURRENT_RUN",
      pass: concurrentRun === 0,
      detail: `running=${concurrentRun}`,
    },
    {
      key: "NO_ACTIVE_AUTHORIZATION",
      pass: !activeAuthorization,
      detail: activeAuthorization?.id ?? "none",
    },
  ];

  const failed = checks.filter((check) => !check.pass);

  if (failed.length) {
    throw new Error(
      `Preflight negado: ${failed.map((check) => check.key).join(", ")}`,
    );
  }

  if (!asset) {
    throw new Error("Target não encontrado.");
  }

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha256(rawToken);
  const fingerprint = bindingFingerprint({
    organizationId: input.organizationId,
    incidentId: input.incidentId,
    planId: plan.id,
    governanceId: governance.id,
    action: plan.action,
    assetExternalId: asset.externalId,
  });

  const who = actor(input.session);
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  const authorization = await prisma.$transaction(async (tx) => {
    const created = await tx.remediationExecutionAuthorization.create({
      data: {
        organizationId: input.organizationId,
        incidentId: input.incidentId,
        planId: plan.id,
        governanceId: governance.id,
        status: "AUTHORIZED",
        tokenHash,
        bindingFingerprint: fingerprint,
        action: plan.action,
        assetExternalId: asset.externalId,
        assetName: asset.name,
        nodeName: asset.nodeName,
        issuedAt: now,
        expiresAt,
        issuedById: who.id,
        issuedByName: who.name,
        preflight: json({
          checks,
          ttlSeconds,
          oneTime: true,
          replayProtected: true,
        }),
        metadata: json({
          version: "015.6.11.6.2",
          realMutationStillBlocked: true,
        }),
      },
    });

    await tx.infrastructureIncidentEvent.create({
      data: {
        organizationId: input.organizationId,
        incidentId: input.incidentId,
        eventType: "REMEDIATION_EXECUTION_AUTHORIZED",
        message:
          `Autorização temporária emitida para ${plan.action}. ` +
          "Executor real permanece bloqueado.",
        actorUserId: who.id,
        actorName: who.name,
        metadata: json({
          authorizationId: created.id,
          planId: plan.id,
          governanceId: governance.id,
          expiresAt: expiresAt.toISOString(),
          realMutationStillBlocked: true,
          version: "015.6.11.6.2",
        }),
      },
    });

    return created;
  });

  return {
    authorization,
    tokenPreview: `${rawToken.slice(0, 6)}…${rawToken.slice(-4)}`,
  };
}

export async function revokeExecutionAuthorization(input: {
  organizationId: string;
  incidentId: string;
  planId: string;
  authorizationId: string;
  reason?: string | null;
  session: SessionLike;
}) {
  if (input.session.user.role !== "ADMIN") {
    throw new Error("Somente ADMIN pode revogar autorização.");
  }

  const authorization =
    await prisma.remediationExecutionAuthorization.findFirst({
      where: {
        id: input.authorizationId,
        organizationId: input.organizationId,
        incidentId: input.incidentId,
        planId: input.planId,
      },
    });

  if (!authorization) throw new Error("Autorização não encontrada.");

  if (authorization.status !== "AUTHORIZED") {
    return authorization;
  }

  const who = actor(input.session);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.remediationExecutionAuthorization.update({
      where: { id: authorization.id },
      data: {
        status: "REVOKED",
        revokedAt: now,
        revokedById: who.id,
        revokedByName: who.name,
        revokeReason: input.reason?.trim().slice(0, 2000) || null,
      },
    });

    await tx.infrastructureIncidentEvent.create({
      data: {
        organizationId: input.organizationId,
        incidentId: input.incidentId,
        eventType: "REMEDIATION_EXECUTION_AUTH_REVOKED",
        message: `Autorização ${authorization.id} revogada.`,
        actorUserId: who.id,
        actorName: who.name,
        metadata: json({
          authorizationId: authorization.id,
          planId: input.planId,
          reason: input.reason?.trim().slice(0, 2000) || null,
          version: "015.6.11.6.2",
        }),
      },
    });

    return updated;
  });
}
