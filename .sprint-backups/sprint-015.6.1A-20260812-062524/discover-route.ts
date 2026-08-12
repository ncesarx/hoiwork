import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { discoverProxmoxNodes } from "@/integrations/discovery/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { session, organization } = await requireOrganization();

    if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
      return NextResponse.json(
        { ok: false, error: "Acesso permitido apenas para ADMIN ou TECHNICIAN." },
        { status: 403 },
      );
    }

    if (process.env.PROXMOX_DEMO_MODE === "true") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Discovery real bloqueado porque PROXMOX_DEMO_MODE=true. Altere para false.",
        },
        { status: 409 },
      );
    }

    const integration = await prisma.integration.upsert({
      where: {
        organizationId_provider: {
          organizationId: organization.id,
          provider: "PROXMOX",
        },
      },
      update: {
        enabled: true,
        mode: "LIVE",
        lastError: null,
      },
      create: {
        organizationId: organization.id,
        provider: "PROXMOX",
        name: "Proxmox VE",
        enabled: true,
        mode: "LIVE",
        status: "PENDING",
      },
    });

    const result = await discoverProxmoxNodes({
      organizationId: organization.id,
      integrationId: integration.id,
      userId: session.user.id,
    });

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: "HEALTHY",
        lastSyncAt: new Date(),
        lastHealthAt: new Date(),
        lastError: null,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `${result.nodes} node(s) real(is) descoberto(s).`,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno desconhecido.";

    try {
      const { organization } = await requireOrganization();
      const integration = await prisma.integration.findUnique({
        where: {
          organizationId_provider: {
            organizationId: organization.id,
            provider: "PROXMOX",
          },
        },
      });

      if (integration) {
        await prisma.integration.update({
          where: { id: integration.id },
          data: { status: "ERROR", lastError: message },
        });
      }
    } catch {}

    console.error("[Discovery Nodes]", error);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
