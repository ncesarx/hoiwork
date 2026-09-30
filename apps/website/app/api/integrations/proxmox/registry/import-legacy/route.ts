import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { encryptCredential } from "@/lib/proxmox/credentials";
import { discoverProxmoxInstance } from "@/integrations/discovery/multi-proxmox-engine";
import { recordProxmoxDiscoveryFailure } from "@/integrations/discovery/proxmox-failure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
  }

  const baseUrl = process.env.PROXMOX_BASE_URL?.trim().replace(/\/$/, "");
  const tokenId = process.env.PROXMOX_TOKEN_ID?.trim();
  const tokenSecret = process.env.PROXMOX_TOKEN_SECRET?.trim();

  if (!baseUrl || !tokenId || !tokenSecret) {
    return NextResponse.json({
    ok: false, error: "Credenciais legacy PROXMOX_* não estão completas." },
      { status: 400 },
    );
  }

  const existing = await prisma.proxmoxInstance.findFirst({
    where: { organizationId: organization.id, baseUrl },
  });

  if (existing) {
    return NextResponse.json(
      { ok: false, error: "Este endpoint já existe no Registry.", instanceId: existing.id },
      { status: 409 },
    );
  }

  const instance = await prisma.proxmoxInstance.create({
    data: {
      organizationId: organization.id,
      slug: "proxmox-principal",
      name: "Proxmox Principal",
      site: "Site Principal",
      baseUrl,
      tokenId,
      tokenSecretEncrypted: encryptCredential(tokenSecret),
      allowSelfSigned: process.env.PROXMOX_ALLOW_SELF_SIGNED === "true",
      status: "PENDING",
    },
  });

  const startedAt = new Date();
  try {
    const result = await discoverProxmoxInstance({
      organizationId: organization.id,
      instanceId: instance.id,
    });

    if (result.skipped) {
      return NextResponse.json(
        { ok: false, error: "Coleta anterior ignorada; confirme o inventário antes de migrar os ativos legacy.", ...result },
        { status: 409 },
      );
    }

    const legacyAssets = await prisma.infrastructureAsset.updateMany({
      where: {
        organizationId: organization.id,
        provider: "PROXMOX",
        active: true,
        NOT: { externalId: { startsWith: "proxmox/" } },
      },
      data: {
        active: false,
        status: "MIGRATED",
        lastChangedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Proxmox principal migrado para o Registry.",
      legacyAssetsRetired: legacyAssets.count,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao migrar ambiente legacy.";

    await recordProxmoxDiscoveryFailure({
      organizationId: organization.id,
      instanceId: instance.id,
      startedAt,
      message,
    });

    return NextResponse.json(
      { ok: false, error: message, instanceId: instance.id },
      { status: 500 },
    );
  }
}
