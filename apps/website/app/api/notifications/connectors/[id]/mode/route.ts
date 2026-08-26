import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { session, organization } = await requireOrganization();

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "Somente ADMIN pode alterar modo LIVE." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const mode = body.mode === "LIVE" ? "LIVE" : "SIMULATED";

  const connector = await prisma.notificationConnector.findFirst({
    where: { id, organizationId: organization.id },
  });

  if (!connector) {
    return NextResponse.json({ ok: false, error: "Conector não encontrado." }, { status: 404 });
  }

  if (mode === "LIVE" && connector.lastTestStatus !== "HEALTHY") {
    return NextResponse.json(
      { ok: false, error: "O conector precisa passar no teste antes de entrar em LIVE." },
      { status: 409 },
    );
  }

  const updated = await prisma.notificationConnector.update({
    where: { id: connector.id },
    data: { mode },
  });

  return NextResponse.json({ ok: true, connector: updated });
}
