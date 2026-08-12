import { prisma } from "@/lib/prisma";
import {
  getProxmoxConfigFromEnv,
  ProxmoxConnector,
} from "@/integrations/proxmox/client";
import { persistNodeAssets } from "@/integrations/discovery/repository";

async function addLog(
  runId: string,
  step: string,
  message: string,
  options?: {
    level?: string;
    durationMs?: number;
    metadata?: Record<string, unknown>;
  },
) {
  await prisma.discoveryLog.create({
    data: {
      runId,
      step,
      level: options?.level ?? "INFO",
      message,
      durationMs: options?.durationMs,
      metadata: options?.metadata
        ? JSON.parse(JSON.stringify(options.metadata))
        : undefined,
    },
  });
}

function clusterNameFromStatus(
  entries: Awaited<ReturnType<ProxmoxConnector["getClusterStatus"]>>,
) {
  const cluster = entries.find((entry) => entry.type === "cluster");
  return cluster?.name || cluster?.id || "Proxmox Cluster";
}

export async function discoverProxmoxNodes(params: {
  organizationId: string;
  integrationId: string;
  userId: string;
}) {
  const config = getProxmoxConfigFromEnv();
  const connector = new ProxmoxConnector(config);

  const run = await prisma.discoveryRun.create({
    data: {
      organizationId: params.organizationId,
      integrationId: params.integrationId,
      userId: params.userId,
      provider: "PROXMOX",
      scope: "NODES",
      status: "RUNNING",
      endpoint: config.baseUrl,
    },
  });

  const overallStart = Date.now();

  try {
    await addLog(run.id, "START", "Discovery Persistence Audit iniciado.", {
      metadata: {
        organizationId: params.organizationId,
        integrationId: params.integrationId,
        endpoint: config.baseUrl,
      },
    });

    let stepStart = Date.now();
    const health = await connector.health();
    if (!health.ok) throw new Error(health.message);

    await addLog(run.id, "CONNECT", "Conexão e autenticação validadas.", {
      durationMs: Date.now() - stepStart,
    });

    stepStart = Date.now();
    const version = await connector.getVersion();
    const versionText =
      version.version ?? version.release ?? "desconhecida";

    await addLog(
      run.id,
      "VERSION",
      `Versão Proxmox detectada: ${versionText}.`,
      {
        durationMs: Date.now() - stepStart,
        metadata: version,
      },
    );

    stepStart = Date.now();
    const clusterStatus = await connector.getClusterStatus();
    const clusterName = clusterNameFromStatus(clusterStatus);

    await addLog(
      run.id,
      "CLUSTER",
      `Cluster identificado: ${clusterName}.`,
      {
        durationMs: Date.now() - stepStart,
        metadata: { entries: clusterStatus.length },
      },
    );

    stepStart = Date.now();
    const nodes = await connector.getNodes();

    console.log("[Discovery Audit] nodes retornados pela API:", nodes);

    await addLog(
      run.id,
      "NODES",
      `${nodes.length} node(s) retornado(s) pela API.`,
      {
        durationMs: Date.now() - stepStart,
        metadata: {
          names: nodes.map((node) => node.node),
        },
      },
    );

    if (!nodes.length) {
      throw new Error(
        "Discovery Audit: endpoint /nodes respondeu com zero nodes.",
      );
    }

    const detailedNodes = [];

    for (const node of nodes) {
      const nodeStart = Date.now();
      const status = await connector.getNodeStatus(node.node);

      detailedNodes.push({
        externalId: `node/${node.node}`,
        name: node.node,
        clusterName,
        status: (node.status ?? "unknown").toUpperCase(),
        cpuPercent:
          typeof status.cpu === "number"
            ? Math.round(status.cpu * 10000) / 100
            : typeof node.cpu === "number"
              ? Math.round(node.cpu * 10000) / 100
              : undefined,
        cpuCores:
          status.cpuinfo?.cpus ??
          status.cpuinfo?.cores ??
          (typeof node.maxcpu === "number"
            ? Math.trunc(node.maxcpu)
            : undefined),
        memoryUsedBytes:
          typeof status.memory?.used === "number"
            ? BigInt(Math.trunc(status.memory.used))
            : typeof node.mem === "number"
              ? BigInt(Math.trunc(node.mem))
              : undefined,
        memoryTotalBytes:
          typeof status.memory?.total === "number"
            ? BigInt(Math.trunc(status.memory.total))
            : typeof node.maxmem === "number"
              ? BigInt(Math.trunc(node.maxmem))
              : undefined,
        diskUsedBytes:
          typeof status.rootfs?.used === "number"
            ? BigInt(Math.trunc(status.rootfs.used))
            : typeof node.disk === "number"
              ? BigInt(Math.trunc(node.disk))
              : undefined,
        diskTotalBytes:
          typeof status.rootfs?.total === "number"
            ? BigInt(Math.trunc(status.rootfs.total))
            : typeof node.maxdisk === "number"
              ? BigInt(Math.trunc(node.maxdisk))
              : undefined,
        uptimeSeconds:
          typeof status.uptime === "number"
            ? BigInt(Math.trunc(status.uptime))
            : typeof node.uptime === "number"
              ? BigInt(Math.trunc(node.uptime))
              : undefined,
        version: status.pveversion ?? versionText,
        metadata: {
          cpuModel: status.cpuinfo?.model,
          sockets: status.cpuinfo?.sockets,
          loadavg: status.loadavg,
          kernelVersion: status.kversion,
          sslFingerprint: node.ssl_fingerprint,
          permissionLevel: node.level,
        },
      });

      await addLog(
        run.id,
        "NODE_STATUS",
        `Node ${node.node} detalhado com sucesso.`,
        { durationMs: Date.now() - nodeStart },
      );
    }

    stepStart = Date.now();

    const persisted = await persistNodeAssets({
      organizationId: params.organizationId,
      integrationId: params.integrationId,
      provider: "PROXMOX",
      nodes: detailedNodes,
    });

    await addLog(
      run.id,
      "PERSIST_VERIFY",
      `${persisted.verifiedCount} node(s) confirmados no PostgreSQL.`,
      {
        durationMs: Date.now() - stepStart,
        metadata: {
          createdCount: persisted.createdCount,
          updatedCount: persisted.updatedCount,
          unchangedCount: persisted.unchangedCount,
          offlineCount: persisted.offlineCount,
          verifiedCount: persisted.verifiedCount,
          externalIds: persisted.verification.map((item) => item.externalId),
        },
      },
    );

    const durationMs = Date.now() - overallStart;

    await prisma.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        durationMs,
        version: versionText,
        clusterName,
        discovered: detailedNodes.length,
        createdCount: persisted.createdCount,
        updatedCount: persisted.updatedCount,
        unchangedCount: persisted.unchangedCount,
        offlineCount: persisted.offlineCount,
        metadata: {
          verifiedCount: persisted.verifiedCount,
        },
      },
    });

    await addLog(
      run.id,
      "FINISH",
      `Discovery concluído com ${persisted.verifiedCount}/${detailedNodes.length} node(s) persistidos.`,
      { durationMs },
    );

    return {
      runId: run.id,
      clusterName,
      version: versionText,
      nodes: detailedNodes.length,
      durationMs,
      ...persisted,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido.";
    const durationMs = Date.now() - overallStart;

    await prisma.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        durationMs,
        errorMessage: message,
      },
    });

    await addLog(run.id, "ERROR", message, {
      level: "ERROR",
      durationMs,
    }).catch(() => {});

    console.error("[Discovery Persistence Audit]", error);

    throw error;
  }
}
