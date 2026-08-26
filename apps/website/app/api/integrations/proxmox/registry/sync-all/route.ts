import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { discoverProxmoxInstance } from "@/integrations/discovery/multi-proxmox-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
  }

  const instances = await prisma.proxmoxInstance.findMany({
    where: { organizationId: organization.id, enabled: true },
    orderBy: { name: "asc" },
  });

  const results: Array<Record<string, unknown>> = [];
  let healthy = 0;
  let failed = 0;

  for (const instance of instances) {
    try {
      const result = await discoverProxmoxInstance({
        organizationId: organization.id,
        instanceId: instance.id,
      });

      healthy += 1;
      results.push({
        instanceId: instance.id,
        name: instance.name,
        ok: true,
        discovered: result.discovered,
        verifiedCount: result.verifiedCount,
      });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Erro desconhecido.";

      await prisma.proxmoxInstance.update({
        where: { id: instance.id },
        data: { status: "ERROR", lastError: message },
      }).catch(() => {});

      results.push({
        instanceId: instance.id,
        name: instance.name,
        ok: false,
        error: message,
      });
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    message:
      failed === 0
        ? `${healthy} instância(s) sincronizada(s) com sucesso.`
        : `${healthy} saudável(is), ${failed} com falha.`,
    healthy,
    failed,
    results,
  }, { status: failed === 0 ? 200 : 207 });
}
