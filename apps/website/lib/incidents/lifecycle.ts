import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getIncidentForOrganization(organizationId: string, id: string) {
  return prisma.infrastructureIncident.findFirst({
    where: { id, organizationId },
    include: {
      events: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function recordIncidentEvent(input: {
  organizationId: string;
  incidentId: string;
  eventType: string;
  message: string;
  actorUserId?: string | null;
  actorName?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  fromSeverity?: string | null;
  toSeverity?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.infrastructureIncidentEvent.create({ data: input });
}
