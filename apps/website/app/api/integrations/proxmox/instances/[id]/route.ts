import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json(
      { ok: false, error: "Acesso negado." },
      { status: 403 },
    );
  }

  const { id } = await context.params;

  const instance = await prisma.proxmoxInstance.findFirst({
    where: {
      id,
      organizationId: organization.id,
    },
    select: {
      id: true,
      name: true,
      baseUrl: true,
    },
  });

  if (!instance) {
    return NextResponse.json(
      { ok: false, error: "Instância não encontrada." },
      { status: 404 },
    );
  }

  try {
    await prisma.proxmoxInstance.delete({
      where: {
        id: instance.id,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Instância "${instance.name}" removida com sucesso.`,
      deletedInstance: {
        id: instance.id,
        name: instance.name,
        baseUrl: instance.baseUrl,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro ao remover instância Proxmox.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
