import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { session, organization } = await requireOrganization();

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "Somente ADMIN pode excluir conectores." },
      { status: 403 },
    );
  }

  const { id } = await context.params;

  const connector = await prisma.notificationConnector.findFirst({
    where: {
      id,
      organizationId: organization.id,
    },
  });

  if (!connector) {
    return NextResponse.json(
      { ok: false, error: "Conector não encontrado." },
      { status: 404 },
    );
  }

  if (connector.mode === "LIVE") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Conector LIVE não pode ser excluído. Volte-o para SIMULATED antes da exclusão.",
      },
      { status: 409 },
    );
  }

  await prisma.notificationConnector.delete({
    where: { id: connector.id },
  });

  return NextResponse.json({
    ok: true,
    message: `Conector "${connector.name}" excluído.`,
  });
}
