import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getIncidentForOrganization, recordIncidentEvent } from "@/lib/incidents/lifecycle";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { session, organization } = await requireOrganization();
  const { id } = await context.params;
  const incident = await getIncidentForOrganization(organization.id, id);
  if (!incident) return NextResponse.json({ ok: false, error: "Incidente não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (text.length < 2 || text.length > 4000) {
    return NextResponse.json({ ok: false, error: "Nota deve conter entre 2 e 4000 caracteres." }, { status: 400 });
  }

  const actorName = session.user.name ?? session.user.email ?? "Operador";
  const note = await prisma.infrastructureIncidentNote.create({
    data: {
      organizationId: organization.id,
      incidentId: incident.id,
      authorUserId: session.user.id,
      authorName: actorName,
      body: text,
    },
  });
  await recordIncidentEvent({
    organizationId: organization.id,
    incidentId: incident.id,
    eventType: "NOTE_ADDED",
    message: "Nota operacional adicionada.",
    actorUserId: session.user.id,
    actorName,
    metadata: { noteId: note.id },
  });
  return NextResponse.json({ ok: true, note });
}
