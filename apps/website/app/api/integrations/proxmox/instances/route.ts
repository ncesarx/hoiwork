import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { encryptCredential } from "@/lib/proxmox/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function GET() {
  const { organization } = await requireOrganization();

  const instances = await prisma.proxmoxInstance.findMany({
    where: { organizationId: organization.id },
    orderBy: [{ enabled: "desc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      site: true,
      baseUrl: true,
      tokenId: true,
      allowSelfSigned: true,
      enabled: true,
      status: true,
      lastHealthAt: true,
      lastSyncAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, instances });
}

export async function POST(request: Request) {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json() as {
    name?: string;
    site?: string;
    baseUrl?: string;
    tokenId?: string;
    tokenSecret?: string;
    allowSelfSigned?: boolean;
  };

  const name = body.name?.trim();
  const baseUrl = body.baseUrl?.trim().replace(/\/$/, "");
  const tokenId = body.tokenId?.trim();
  const tokenSecret = body.tokenSecret?.trim();

  if (!name || !baseUrl || !tokenId || !tokenSecret) {
    return NextResponse.json(
      { ok: false, error: "Nome, URL, Token ID e Token Secret são obrigatórios." },
      { status: 400 },
    );
  }

  const slug = slugify(name);
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Nome inválido." }, { status: 400 });
  }

  try {
    const instance = await prisma.proxmoxInstance.create({
      data: {
        organizationId: organization.id,
        slug,
        name,
        site: body.site?.trim() || null,
        baseUrl,
        tokenId,
        tokenSecretEncrypted: encryptCredential(tokenSecret),
        allowSelfSigned: body.allowSelfSigned !== false,
        status: "PENDING",
      },
      select: {
        id: true,
        slug: true,
        name: true,
        site: true,
        baseUrl: true,
        tokenId: true,
        allowSelfSigned: true,
        enabled: true,
        status: true,
      },
    });

    return NextResponse.json({ ok: true, instance }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao cadastrar instância.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
