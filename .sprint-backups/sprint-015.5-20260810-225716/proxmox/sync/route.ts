import { NextResponse } from "next/server";

import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { synchronizeIntegration } from "@/integrations/core/sync-engine";
import {
  getProxmoxConfigFromEnv,
  ProxmoxConnector,
} from "@/integrations/proxmox/client";
import { ProxmoxDemoConnector } from "@/integrations/proxmox/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  console.log("[Proxmox Sync] Requisição recebida.");

  try {
    const { session, organization } = await requireOrganization();

    console.log("[Proxmox Sync] Usuário:", session.user.email);
    console.log("[Proxmox Sync] Papel:", session.user.role);
    console.log("[Proxmox Sync] Organização:", organization.id);

    if (
      session.user.role !== "ADMIN" &&
      session.user.role !== "TECHNICIAN"
    ) {
      return NextResponse.json(
        {
          ok: false,
          stage: "authorization",
          error: "Acesso permitido apenas para ADMIN ou TECHNICIAN.",
        },
        { status: 403 },
      );
    }

    const demoMode = process.env.PROXMOX_DEMO_MODE === "true";

    console.log(
      "[Proxmox Sync] Modo:",
      demoMode ? "DEMO" : "LIVE",
    );

    const integration = await prisma.integration.upsert({
      where: {
        organizationId_provider: {
          organizationId: organization.id,
          provider: "PROXMOX",
        },
      },
      update: {
        enabled: true,
        mode: demoMode ? "DEMO" : "LIVE",
      },
      create: {
        organizationId: organization.id,
        provider: "PROXMOX",
        name: "Proxmox VE",
        enabled: true,
        mode: demoMode ? "DEMO" : "LIVE",
        status: "PENDING",
      },
    });

    console.log(
      "[Proxmox Sync] Integração criada/localizada:",
      integration.id,
    );

    const provider = demoMode
      ? new ProxmoxDemoConnector()
      : new ProxmoxConnector(getProxmoxConfigFromEnv());

    const result = await synchronizeIntegration({
      organizationId: organization.id,
      integrationId: integration.id,
      provider,
    });

    console.log(
      "[Proxmox Sync] Recursos sincronizados:",
      result.resources,
    );

    return NextResponse.json({
      ok: true,
      message: "Sincronização concluída com sucesso.",
      resources: result.resources,
    });
  } catch (error: unknown) {
    console.error("[Proxmox Sync] Falha:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Erro interno desconhecido.";

    const cause =
      error instanceof Error &&
      error.cause instanceof Error
        ? error.cause.message
        : undefined;

    return NextResponse.json(
      {
        ok: false,
        stage: "sync",
        error: message,
        cause,
      },
      { status: 500 },
    );
  }
}
