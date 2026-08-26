import { prisma } from "@/lib/prisma";

function minutesBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 60000);
}

export async function governAlertDeliveries(organizationId: string) {
  const now = new Date();

  const [windows, policies, deliveries] = await Promise.all([
    prisma.notificationMaintenanceWindow.findMany({
      where: {
        organizationId,
        enabled: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    }),
    prisma.alertPolicy.findMany({
      where: { organizationId, enabled: true },
    }),
    prisma.alertDelivery.findMany({
      where: {
        organizationId,
        status: { in: ["PENDING", "RETRY_PENDING", "HELD_TEST"] },
      },
      include: {
        incident: true,
        policy: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const maintenanceActive = windows.length > 0;

  let heldMaintenance = 0;
  let heldCooldown = 0;
  let released = 0;
  let untouched = 0;

  for (const delivery of deliveries) {
    if (delivery.status === "HELD_TEST") {
      untouched += 1;
      continue;
    }

    if (maintenanceActive) {
      await prisma.alertDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "HELD_MAINTENANCE",
          errorMessage: `Retido por maintenance window: ${windows.map(w => w.name).join(", ")}`,
        },
      });
      heldMaintenance += 1;
      continue;
    }

    const policy = policies.find((p) => p.id === delivery.policyId) ?? delivery.policy;

    if (!policy) {
      untouched += 1;
      continue;
    }

    const lastSent = await prisma.alertDelivery.findFirst({
      where: {
        organizationId,
        incidentId: delivery.incidentId,
        policyId: delivery.policyId,
        channel: delivery.channel,
        recipient: delivery.recipient,
        status: "SENT",
        id: { not: delivery.id },
      },
      orderBy: { sentAt: "desc" },
    });

    if (lastSent?.sentAt) {
      const elapsed = minutesBetween(now, lastSent.sentAt);

      if (elapsed < policy.repeatEveryMinutes) {
        await prisma.alertDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "HELD_COOLDOWN",
            errorMessage: `Cooldown ativo: ${elapsed}/${policy.repeatEveryMinutes} min.`,
          },
        });
        heldCooldown += 1;
        continue;
      }
    }

    untouched += 1;
  }

  const maintenanceEnded = await prisma.alertDelivery.findMany({
    where: {
      organizationId,
      status: "HELD_MAINTENANCE",
    },
    include: { policy: true },
  });

  if (!maintenanceActive) {
    for (const delivery of maintenanceEnded) {
      await prisma.alertDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "PENDING",
          errorMessage: null,
        },
      });
      released += 1;
    }
  }

  const cooldownHeld = await prisma.alertDelivery.findMany({
    where: {
      organizationId,
      status: "HELD_COOLDOWN",
    },
    include: { policy: true },
  });

  for (const delivery of cooldownHeld) {
    if (!delivery.policy) continue;

    const lastSent = await prisma.alertDelivery.findFirst({
      where: {
        organizationId,
        incidentId: delivery.incidentId,
        policyId: delivery.policyId,
        channel: delivery.channel,
        recipient: delivery.recipient,
        status: "SENT",
      },
      orderBy: { sentAt: "desc" },
    });

    if (!lastSent?.sentAt) {
      await prisma.alertDelivery.update({
        where: { id: delivery.id },
        data: { status: "PENDING", errorMessage: null },
      });
      released += 1;
      continue;
    }

    const elapsed = minutesBetween(now, lastSent.sentAt);
    if (elapsed >= delivery.policy.repeatEveryMinutes) {
      await prisma.alertDelivery.update({
        where: { id: delivery.id },
        data: { status: "PENDING", errorMessage: null },
      });
      released += 1;
    }
  }

  return {
    maintenanceActive,
    maintenanceWindows: windows.length,
    heldMaintenance,
    heldCooldown,
    released,
    untouched,
  };
}

export async function releaseHeldTestDeliveries(
  organizationId: string,
  limit = 1,
) {
  const held = await prisma.alertDelivery.findMany({
    where: {
      organizationId,
      status: "HELD_TEST",
    },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 100)),
  });

  for (const delivery of held) {
    await prisma.alertDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "PENDING",
        errorMessage: null,
      },
    });
  }

  return { released: held.length };
}
