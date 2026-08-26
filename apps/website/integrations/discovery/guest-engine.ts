import { prisma } from "@/lib/prisma";
import { ProxmoxGuestClient } from "@/integrations/proxmox/guest-client";
import { persistGuestAssets } from "@/integrations/discovery/guest-repository";

async function addLog(
  runId: string,
  step: string,
  message: string,
  options?: { level?: string; durationMs?: number; metadata?: Record<string, unknown> },
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

export async function discoverProxmoxGuests(params: {
  organizationId: string;
  integrationId: string;
  userId: string;
}) {
  const client = new ProxmoxGuestClient();

  const run = await prisma.discoveryRun.create({
    data: {
      organizationId: params.organizationId,
      integrationId: params.integrationId,
      userId: params.userId,
      provider: "PROXMOX",
      scope: "VIRTUAL_GUESTS",
      status: "RUNNING",
      endpoint: process.env.PROXMOX_BASE_URL,
    },
  });

  const started = Date.now();

  try {
    await addLog(run.id, "START", "Virtual Infrastructure Discovery iniciado.");

    let stepStarted = Date.now();
    const guests = await client.getGuests();

    const qemuCount = guests.filter((g) => g.type === "qemu").length;
    const lxcCount = guests.filter((g) => g.type === "lxc").length;

    await addLog(
      run.id,
      "GUESTS",
      `${guests.length} guest(s) encontrado(s): ${qemuCount} VM(s) e ${lxcCount} LXC(s).`,
      {
        durationMs: Date.now() - stepStarted,
        metadata: { qemuCount, lxcCount },
      },
    );

    const normalized = [];

    for (const guest of guests) {
      stepStarted = Date.now();
      const status = await client.getStatus(guest);

      normalized.push({
        externalId: `${guest.type}/${guest.vmid}`,
        assetType: guest.type === "qemu" ? ("VM" as const) : ("LXC" as const),
        name: status.name ?? guest.name ?? `${guest.type}-${guest.vmid}`,
        nodeName: guest.node,
        parentExternalId: `node/${guest.node}`,
        status: (status.status ?? guest.status ?? "unknown").toUpperCase(),
        cpuPercent:
          typeof status.cpu === "number"
            ? Math.round(status.cpu * 10000) / 100
            : typeof guest.cpu === "number"
              ? Math.round(guest.cpu * 10000) / 100
              : undefined,
        cpuCores:
          typeof status.cpus === "number"
            ? Math.trunc(status.cpus)
            : typeof guest.maxcpu === "number"
              ? Math.trunc(guest.maxcpu)
              : undefined,
        memoryUsedBytes:
          typeof status.mem === "number"
            ? BigInt(Math.trunc(status.mem))
            : typeof guest.mem === "number"
              ? BigInt(Math.trunc(guest.mem))
              : undefined,
        memoryTotalBytes:
          typeof status.maxmem === "number"
            ? BigInt(Math.trunc(status.maxmem))
            : typeof guest.maxmem === "number"
              ? BigInt(Math.trunc(guest.maxmem))
              : undefined,
        diskUsedBytes:
          typeof status.disk === "number"
            ? BigInt(Math.trunc(status.disk))
            : typeof guest.disk === "number"
              ? BigInt(Math.trunc(guest.disk))
              : undefined,
        diskTotalBytes:
          typeof status.maxdisk === "number"
            ? BigInt(Math.trunc(status.maxdisk))
            : typeof guest.maxdisk === "number"
              ? BigInt(Math.trunc(guest.maxdisk))
              : undefined,
        uptimeSeconds:
          typeof status.uptime === "number"
            ? BigInt(Math.trunc(status.uptime))
            : typeof guest.uptime === "number"
              ? BigInt(Math.trunc(guest.uptime))
              : undefined,
        metadata: {
          vmid: guest.vmid,
          guestType: guest.type,
          node: guest.node,
          tags: status.tags ?? guest.tags,
          pool: guest.pool,
          lock: status.lock ?? guest.lock,
          qmpstatus: status.qmpstatus,
          pid: status.pid,
        },
      });

      await addLog(
        run.id,
        "GUEST_STATUS",
        `${guest.type.toUpperCase()} ${guest.vmid} (${guest.name ?? "sem nome"}) detalhado.`,
        { durationMs: Date.now() - stepStarted },
      );
    }

    stepStarted = Date.now();
    const persisted = await persistGuestAssets({
      organizationId: params.organizationId,
      integrationId: params.integrationId,
      guests: normalized,
    });

    await addLog(
      run.id,
      "PERSIST_VERIFY",
      `${persisted.verifiedCount}/${normalized.length} guest(s) confirmados no PostgreSQL.`,
      {
        durationMs: Date.now() - stepStarted,
        metadata: persisted,
      },
    );

    const durationMs = Date.now() - started;

    await prisma.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        durationMs,
        discovered: normalized.length,
        createdCount: persisted.createdCount,
        updatedCount: persisted.updatedCount,
        unchangedCount: persisted.unchangedCount,
        offlineCount: persisted.offlineCount,
        metadata: {
          qemuCount,
          lxcCount,
          verifiedCount: persisted.verifiedCount,
        },
      },
    });

    await addLog(
      run.id,
      "FINISH",
      `Virtual Discovery concluído em ${durationMs} ms.`,
      { durationMs },
    );

    return {
      runId: run.id,
      guests: normalized.length,
      qemuCount,
      lxcCount,
      durationMs,
      ...persisted,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido.";
    const durationMs = Date.now() - started;

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

    throw error;
  }
}
