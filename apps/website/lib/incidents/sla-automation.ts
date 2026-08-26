import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { evaluateIncidentSlaBreaches } from "@/lib/incidents/sla-breach-engine";

async function acquireLock(organizationId: string) {
  const key = `hoiwork:sla-automation:${organizationId}`;

  const rows = await prisma.$queryRaw<Array<{ acquired: boolean }>>(
    Prisma.sql`SELECT pg_try_advisory_lock(hashtext(${key})) AS acquired`,
  );

  return {
    acquired: Boolean(rows[0]?.acquired),
    key,
  };
}

async function releaseLock(key: string) {
  await prisma.$queryRaw(
    Prisma.sql`SELECT pg_advisory_unlock(hashtext(${key}))`,
  );
}

export async function runIncidentSlaAutomation(input: {
  organizationId: string;
  source: "MANUAL" | "SCHEDULER";
  commit: boolean;
}) {
  const lock = await acquireLock(input.organizationId);

  if (!lock.acquired) {
    return {
      executionSkipped: true as const,
      reason: "CONCURRENT_RUN",
    };
  }

  try {
    const result = await evaluateIncidentSlaBreaches({
      organizationId: input.organizationId,
      source: input.source,
      commit: input.commit,
    });

    return {
      executionSkipped: false as const,
      ...result,
    };
  } finally {
    await releaseLock(lock.key).catch(() => {});
  }
}
