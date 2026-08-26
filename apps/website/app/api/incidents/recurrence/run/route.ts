import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { runIncidentRecurrenceDetection } from "@/lib/incidents/incident-recurrence";

export async function POST() {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json(
      { ok: false, error: "Acesso negado." },
      { status: 403 },
    );
  }

  try {
    const result = await runIncidentRecurrenceDetection(organization.id);
    return NextResponse.json({
      ok: true,
      message:
        result.created > 0
          ? `${result.created} recorrência(s) aberta(s).`
          : "Nenhuma nova recorrência aberta.",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha no detector de recorrência.",
      },
      { status: 400 },
    );
  }
}
