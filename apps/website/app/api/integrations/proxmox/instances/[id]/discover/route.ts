import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { discoverProxmoxInstance } from "@/integrations/discovery/multi-proxmox-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const startedAt = new Date();

  try {
    const result = await discoverProxmoxInstance({
      organizationId: organization.id,
      instanceId: id,
    });

    return NextResponse.json({
      ok: true,
      message: `${result.verifiedCount} ativo(s) isolado(s) e verificado(s) para esta instância.`,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no discovery.";
    await prisma.proxmoxInstance.updateMany({
      where: {
        id,
        organizationId: organization.id,
        enabled: true,
        OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: startedAt } }],
      },
      data: { status: "ERROR", lastHealthAt: new Date(), lastError: message },
    }).catch(() => {});

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
