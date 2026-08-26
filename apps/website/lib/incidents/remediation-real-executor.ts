import https from "https";
import { URL } from "url";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertRemediationCycleIntegrity } from "@/lib/incidents/remediation-cycle-isolation";
import { assertCapabilityEnforcement } from "@/lib/governance/autonomous-enforcement-gate";

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
    name: session.user.name ?? session.user.email ?? "Administrador",
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

function parseSecretMap() {
  const raw = process.env.HOIWORK_PROXMOX_EXECUTION_SECRETS_JSON;
  if (!raw) return {} as Record<string, string>;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, string>;
  } catch {
    throw new Error("HOIWORK_PROXMOX_EXECUTION_SECRETS_JSON inválido.");
  }
}

function parseVmid(externalId: string) {
  const match = externalId.match(/\/qemu\/(\d+)(?:\/|$)/i);
  return match ? match[1] : null;
}

function parseInstanceId(externalId: string) {
  const match = externalId.match(/^proxmox\/([^/]+)\//i);
  return match ? match[1] : null;
}

async function proxmoxStartVm(input: {
  baseUrl: string;
  tokenId: string;
  tokenSecret: string;
  nodeName: string;
  vmid: string;
  allowSelfSigned: boolean;
}) {
  const url = new URL(
    `/api2/json/nodes/${encodeURIComponent(input.nodeName)}/qemu/${encodeURIComponent(input.vmid)}/status/start`,
    input.baseUrl.endsWith("/") ? input.baseUrl : `${input.baseUrl}/`,
  );

  return new Promise<{
    statusCode: number;
    body: unknown;
    rawBody: string;
  }>((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        rejectUnauthorized: !input.allowSelfSigned,
        headers: {
          Authorization: `PVEAPIToken=${input.tokenId}=${input.tokenSecret}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": "0",
        },
        timeout: 15000,
      },
      (res) => {
        const chunks: Buffer[] = [];

        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const rawBody = Buffer.concat(chunks).toString("utf-8");

          let body: unknown = rawBody;
          try {
            body = rawBody ? JSON.parse(rawBody) : null;
          } catch {
            // keep raw body
          }

          resolve({
            statusCode: res.statusCode ?? 0,
            body,
            rawBody,
          });
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error("Timeout ao chamar Proxmox."));
    });

    req.on("error", reject);
    req.end();
  });
}

export async function executeAuthorizedStartVm(input: {
  organizationId: string;
  incidentId: string;
  planId: string;
  authorizationId: string;
  confirmation: string;
  session: SessionLike;
}) {
  if (input.session.user.role !== "ADMIN") {
    throw new Error("Somente ADMIN pode executar remediação real.");
  }

  if (input.confirmation !== "START_VM") {
    throw new Error('Confirmação inválida. Digite exatamente "START_VM".');
  }

  const autonomousGovernance =
    await assertCapabilityEnforcement({
      organizationId: input.organizationId,
      capability: "REMEDIATION_REAL",
    });

  if (!envTrue("HOIWORK_REAL_START_VM_EXECUTOR_ENABLED", false)) {
    throw new Error("Executor real START_VM está desabilitado.");
  }

  if (envTrue("HOIWORK_REAL_REMEDIATION_KILL_SWITCH", true)) {
    throw new Error("Kill switch ativo. Execução real bloqueada.");
  }

  if (!envTrue("HOIWORK_REAL_REMEDIATION_POLICY_ENABLED", false)) {
    throw new Error("Policy real desabilitada.");
  }

  if (!envTrue("HOIWORK_REMEDIATION_MAINTENANCE_OPEN", false)) {
    throw new Error("Maintenance window fechada.");
  }

  const now = new Date();

  const plan = await prisma.remediationExecutionPlan.findFirst({
    where: {
      id: input.planId,
      organizationId: input.organizationId,
      incidentId: input.incidentId,
      status: "APPROVED",
      action: "START_VM",
    },
    include: { incident: true },
  });

  if (!plan) {
    throw new Error("Plano START_VM APPROVED não encontrado.");
  }

  if (plan.expiresAt && plan.expiresAt <= now) {
    throw new Error("Plano expirado.");
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

  if (!authorization) {
    throw new Error("Autorização não encontrada.");
  }

  if (
    authorization.status !== "AUTHORIZED" ||
    authorization.revokedAt ||
    authorization.consumedAt ||
    authorization.expiresAt <= now
  ) {
    throw new Error("Autorização não está ativa para consumo.");
  }

  const governance =
    await prisma.remediationGovernanceEvaluation.findFirst({
      where: {
        id: authorization.governanceId,
        organizationId: input.organizationId,
        incidentId: input.incidentId,
        planId: input.planId,
        decision: "REAL_EXECUTION_ELIGIBLE",
        eligibleForRealExecution: true,
      },
    });

  if (!governance) {
    throw new Error("Governança elegível não encontrada.");
  }

  await assertRemediationCycleIntegrity({
    organizationId: input.organizationId,
    incidentId: input.incidentId,
    planId: input.planId,
    governanceId: governance.id,
    authorizationId: authorization.id,
  });

  if (now.getTime() - governance.evaluatedAt.getTime() > 5 * 60 * 1000) {
    throw new Error("Governança ficou stale. Reavalie antes da execução.");
  }

  const asset = await prisma.infrastructureAsset.findFirst({
    where: {
      organizationId: input.organizationId,
      externalId: authorization.assetExternalId,
      active: true,
    },
    orderBy: { lastSeenAt: "desc" },
  });

  if (!asset) {
    throw new Error("Target ativo não encontrado.");
  }

  if (
    asset.provider.toUpperCase() !== "PROXMOX" ||
    asset.assetType.toUpperCase() !== "VM"
  ) {
    throw new Error("Target não é uma VM Proxmox elegível.");
  }

  if (asset.status.toUpperCase() !== "STOPPED") {
    throw new Error(
      `Preflight final bloqueou execução: asset status=${asset.status}.`,
    );
  }

  if (!asset.nodeName || asset.nodeName !== authorization.nodeName) {
    throw new Error("Binding de node inválido ou alterado.");
  }

  const vmid = parseVmid(asset.externalId);
  if (!vmid) {
    throw new Error("VMID não pôde ser derivado de InfrastructureAsset.externalId.");
  }

  const instanceId =
    plan.incident.instanceId ??
    parseInstanceId(asset.externalId);

  if (!instanceId) {
    throw new Error("ProxmoxInstance não pôde ser determinado.");
  }

  const instance = await prisma.proxmoxInstance.findFirst({
    where: {
      id: instanceId,
      organizationId: input.organizationId,
      enabled: true,
    },
  });

  if (!instance) {
    throw new Error("ProxmoxInstance habilitada não encontrada.");
  }

  const secretMap = parseSecretMap();
  const tokenSecret =
    secretMap[instance.id] ??
    secretMap[instance.slug];

  if (!tokenSecret) {
    throw new Error(
      `Secret de execução ausente para ProxmoxInstance ${instance.name}.`,
    );
  }

  /*
   * Atomic consume: exactly one request can transition this authorization.
   * Any replay loses the race and is denied.
   */
  const consumed = await prisma.remediationExecutionAuthorization.updateMany({
    where: {
      id: authorization.id,
      organizationId: input.organizationId,
      status: "AUTHORIZED",
      consumedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      status: "CONSUMED",
      consumedAt: now,
    },
  });

  if (consumed.count !== 1) {
    throw new Error("Autorização já consumida, revogada ou expirada.");
  }

  const who = actor(input.session);
  const startedAt = new Date();

  const run = await prisma.remediationExecutionRun.create({
    data: {
      organizationId: input.organizationId,
      incidentId: input.incidentId,
      planId: plan.id,
      mode: "REAL",
      status: "RUNNING",
      executor: "PROXMOX_START_VM_V1",
      request: json({
        action: "START_VM",
        authorizationId: authorization.id,
        governanceId: governance.id,
        instanceId: instance.id,
        instanceName: instance.name,
        nodeName: asset.nodeName,
        vmid,
        assetExternalId: asset.externalId,
      }),
      preconditions: json({
        authorizationConsumedAtomically: true,
        killSwitchOff: true,
        policyEnabled: true,
        maintenanceOpen: true,
        governanceFresh: true,
        targetStatusBefore: asset.status,
        confirmedByHuman: true,
      }),
      startedAt,
      createdById: who.id,
      createdByName: who.name,
    },
  });

  try {
    const response = await proxmoxStartVm({
      baseUrl: instance.baseUrl,
      tokenId: instance.tokenId,
      tokenSecret,
      nodeName: asset.nodeName,
      vmid,
      allowSelfSigned: instance.allowSelfSigned,
    });

    const finishedAt = new Date();

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(
        `Proxmox respondeu HTTP ${response.statusCode}: ${response.rawBody.slice(0, 500)}`,
      );
    }

    const completed = await prisma.$transaction(async (tx) => {
      const updatedRun = await tx.remediationExecutionRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          result: json({
            mutationPerformed: true,
            provider: "PROXMOX",
            action: "START_VM",
            statusCode: response.statusCode,
            response: response.body,
            expectedPostState: "RUNNING",
            verificationRequired: true,
          }),
        },
      });

      await tx.remediationExecutionPlan.update({
        where: { id: plan.id },
        data: {
          executedAt: finishedAt,
        },
      });

      await tx.infrastructureIncidentEvent.create({
        data: {
          organizationId: input.organizationId,
          incidentId: input.incidentId,
          eventType: "REMEDIATION_REAL_EXECUTED",
          message:
            `START_VM executado no Proxmox para ${asset.name}. ` +
            "Verificação pós-execução obrigatória.",
          actorUserId: who.id,
          actorName: who.name,
          metadata: json({
            version: "015.6.11.6.3",
            planId: plan.id,
            runId: run.id,
            authorizationId: authorization.id,
            governanceId: governance.id,
            nodeName: asset.nodeName,
            vmid,
            mutationPerformed: true,
            verificationRequired: true,
          }),
        },
      });

      return updatedRun;
    });

    return {
      run: completed,
      authorizationId: authorization.id,
      target: {
        instanceName: instance.name,
        nodeName: asset.nodeName,
        vmid,
        assetName: asset.name,
      },
    };
  } catch (error) {
    const finishedAt = new Date();
    const message =
      error instanceof Error ? error.message : "Falha no executor real.";

    await prisma.$transaction(async (tx) => {
      await tx.remediationExecutionRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          errorMessage: message,
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        },
      });

      await tx.infrastructureIncidentEvent.create({
        data: {
          organizationId: input.organizationId,
          incidentId: input.incidentId,
          eventType: "REMEDIATION_REAL_FAILED",
          message: `START_VM falhou: ${message.slice(0, 500)}`,
          actorUserId: who.id,
          actorName: who.name,
          metadata: json({
            version: "015.6.11.6.3",
            planId: plan.id,
            runId: run.id,
            authorizationId: authorization.id,
            mutationPerformed: false,
          }),
        },
      });
    });

    throw error;
  }
}
