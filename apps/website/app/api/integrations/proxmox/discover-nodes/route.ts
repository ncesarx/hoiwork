import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { discoverProxmoxNodes } from "@/integrations/discovery/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  let integrationId: string | undefined;

  try {
    const { session, organization } = await requireOrganization();

    if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
      return NextResponse.json(
        {
          ok: false,
          stage: "authorization",
          error: "Acesso permitido apenas para ADMIN ou TECHNICIAN.",
        },
        { status: 403 },
      );
    }

    if (process.env.PROXMOX_DEMO_MODE === "true") {
      return NextResponse.json(
        {
          ok: false,
          stage: "configuration",
          error:
            "Discovery real bloqueado porque PROXMOX_DEMO_MODE=true.",
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

    integrationId = integration.id;

    const result = await discoverProxmoxNodes({
      organizationId: organization.id,
      integrationId: integration.id,
      userId: session.user.id,
    });

    if (result.verifiedCount !== result.nodes) {
      throw new Error(
        `Route Audit: Discovery retornou ${result.nodes} node(s), mas apenas ${result.verifiedCount} foram confirmados no PostgreSQL.`,
      );
    }

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: "HEALTHY",
        lastSyncAt: new Date(),
        lastHealthAt: new Date(),
        lastError: null,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        stage: "completed",
        message: `${result.verifiedCount} node(s) real(is) persistido(s) e verificado(s).`,
        ...result,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-HOIWORK-Discovery": "015.6.1A",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro interno desconhecido.";

    if (integrationId) {
      await prisma.integration
        .update({
          where: { id: integrationId },
          data: {
            status: "ERROR",
            lastError: message,
          },
        })
        .catch(() => {});
    }

    console.error("[Discovery Route Audit]", error);

    return NextResponse.json(
      {
        ok: false,
        stage: "discovery",
        error: message,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "X-HOIWORK-Discovery": "015.6.1A",
        },
      },
    );
  }
}
