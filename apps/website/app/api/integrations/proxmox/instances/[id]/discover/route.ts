import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { discoverProxmoxInstance } from "@/integrations/discovery/multi-proxmox-engine";
import { recordProxmoxDiscoveryFailure } from "@/integrations/discovery/proxmox-failure";

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
    await recordProxmoxDiscoveryFailure({
      instanceId: id,
      organizationId: organization.id,
      startedAt,
      message,
    }).catch(() => {});

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
