import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json(
      { ok: false, error: "Acesso negado." },
      { status: 403 },
    );
  }

  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_provider: {
        organizationId: organization.id,
        provider: "PROXMOX",
      },
    },
  });

  const [assets, runs] = await Promise.all([
    prisma.infrastructureAsset.findMany({
      where: {
        organizationId: organization.id,
        provider: "PROXMOX",
        assetType: "NODE",
      },
      select: {
        id: true,
        externalId: true,
        name: true,
        status: true,
        active: true,
        lastSeenAt: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.discoveryRun.findMany({
      where: {
        organizationId: organization.id,
        provider: "PROXMOX",
        scope: "NODES",
      },
      select: {
        id: true,
        status: true,
        discovered: true,
        createdCount: true,
        updatedCount: true,
        unchangedCount: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
      },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
  ]);

  return NextResponse.json({
    ok: true,
    organization: {
      id: organization.id,
      name: organization.name,
    },
    integration: integration
      ? {
          id: integration.id,
          status: integration.status,
          mode: integration.mode,
          lastError: integration.lastError,
          lastSyncAt: integration.lastSyncAt,
        }
      : null,
    assetCount: assets.length,
    assets,
    runs,
  });
}
