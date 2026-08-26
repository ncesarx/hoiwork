import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getIncidentForOrganization, recordIncidentEvent } from "@/lib/incidents/lifecycle";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { session, organization } = await requireOrganization();
  const { id } = await context.params;
  const incident = await getIncidentForOrganization(organization.id, id);
  if (!incident) return NextResponse.json({ ok: false, error: "Incidente não encontrado." }, { status: 404 });

  if (incident.status !== "RESOLVED") {
    const now = new Date();
    await prisma.infrastructureIncident.update({
      where: { id: incident.id },
      data: { status: "RESOLVED", resolvedAt: now },
    });
    await recordIncidentEvent({
      organizationId: organization.id,
      incidentId: incident.id,
      eventType: "RESOLVED_MANUALLY",
      message: "Incidente encerrado manualmente pela operação.",
      actorUserId: session.user.id,
      actorName: session.user.name ?? session.user.email ?? "Operador",
      fromStatus: incident.status,
      toStatus: "RESOLVED",
    });
  }
  return NextResponse.json({ ok: true });
}
