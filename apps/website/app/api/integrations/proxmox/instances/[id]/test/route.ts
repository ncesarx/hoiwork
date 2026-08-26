import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { decryptCredential } from "@/lib/proxmox/credentials";
import { ProxmoxInstanceClient } from "@/integrations/proxmox/instance-client";

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

  const instance = await prisma.proxmoxInstance.findFirst({
    where: { id, organizationId: organization.id },
  });

  if (!instance) {
    return NextResponse.json({ ok: false, error: "Instância não encontrada." }, { status: 404 });
  }

  try {
    const client = new ProxmoxInstanceClient({
      baseUrl: instance.baseUrl,
      tokenId: instance.tokenId,
      tokenSecret: decryptCredential(instance.tokenSecretEncrypted),
      allowSelfSigned: instance.allowSelfSigned,
    });

    const started = Date.now();
    const [version, nodes] = await Promise.all([client.version(), client.nodes()]);
    const latencyMs = Date.now() - started;

    await prisma.proxmoxInstance.update({
      where: { id: instance.id },
      data: {
        status: "HEALTHY",
        lastHealthAt: new Date(),
        lastError: null,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Conexão validada.",
      version,
      nodeCount: nodes.length,
      latencyMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha de conexão.";

    await prisma.proxmoxInstance.update({
      where: { id: instance.id },
      data: {
        status: "ERROR",
        lastHealthAt: new Date(),
        lastError: message,
      },
    });

    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
