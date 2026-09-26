import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { encryptCredential } from "@/lib/proxmox/credentials";
import { ProxmoxInstanceClient } from "@/integrations/proxmox/instance-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  tokenId: z.string().trim().min(1).max(256),
  tokenSecret: z.string().trim().min(1).max(1024),
}).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { session, organization } = await requireOrganization();
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "Somente ADMIN pode atualizar credenciais." },
      { status: 403 },
    );
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Informe Token ID e Token Secret válidos." },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const instance = await prisma.proxmoxInstance.findFirst({
    where: { id, organizationId: organization.id },
  });
  if (!instance) {
    return NextResponse.json(
      { ok: false, error: "Instância não encontrada." },
      { status: 404 },
    );
  }

  let tokenSecretEncrypted: string;
  try {
    tokenSecretEncrypted = encryptCredential(parsed.data.tokenSecret);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Criptografia de credenciais indisponível." },
      { status: 503 },
    );
  }

  let nodeCount: number;
  try {
    const client = new ProxmoxInstanceClient({
      baseUrl: instance.baseUrl,
      tokenId: parsed.data.tokenId,
      tokenSecret: parsed.data.tokenSecret,
      allowSelfSigned: instance.allowSelfSigned,
    });
    const [nodes] = await Promise.all([
      client.nodes(),
      client.guests(),
      client.storages(),
      client.version(),
    ]);
    if (nodes.length === 0) {
      throw new Error("Nenhum node visível com este token.");
    }
    for (const node of nodes) {
      await client.network(node.node);
    }
    nodeCount = nodes.length;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Novo token não validado para a descoberta completa. Confira ID, segredo e permissões de nodes, guests, storages e redes; as credenciais anteriores foram preservadas." },
      { status: 422 },
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.proxmoxInstance.updateMany({
      where: {
        id: instance.id,
        organizationId: organization.id,
        tokenId: instance.tokenId,
        tokenSecretEncrypted: instance.tokenSecretEncrypted,
      },
      data: {
        tokenId: parsed.data.tokenId,
        tokenSecretEncrypted,
        status: "HEALTHY",
        lastHealthAt: new Date(),
        lastError: null,
      },
    });
    if (result.count !== 1) return false;

    await tx.auditLog.create({
      data: {
        organizationId: organization.id,
        userId: session.user.id,
        action: "PROXMOX_CREDENTIAL_ROTATED",
        entity: "ProxmoxInstance",
        entityId: instance.id,
        metadata: { validatedNodeCount: nodeCount },
      },
    });
    return true;
  });

  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "Credenciais alteradas durante a validação. Recarregue a página e tente novamente." },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { ok: true, message: "Novo token validado e salvo.", nodeCount },
    { headers: { "Cache-Control": "no-store" } },
  );
}
