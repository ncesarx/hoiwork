import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { verifySmtp, smtpConfig } from "@/lib/notifications/smtp";

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

  const connector = await prisma.notificationConnector.findFirst({
    where: { id, organizationId: organization.id },
  });

  if (!connector) {
    return NextResponse.json({ ok: false, error: "Conector não encontrado." }, { status: 404 });
  }

  try {
    if (connector.type === "EMAIL") {
      const secret = connector.secretRef ? process.env[connector.secretRef] : undefined;
      await verifySmtp(smtpConfig(connector.config), secret);
    } else if (connector.type === "WEBHOOK") {
      const config =
        connector.config && typeof connector.config === "object" && !Array.isArray(connector.config)
          ? (connector.config as Record<string, unknown>)
          : {};

      const url = typeof config.url === "string" ? config.url : "";
      if (!url) throw new Error("URL do Webhook não configurada.");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(url, { method: "HEAD", signal: controller.signal });
        if (!response.ok && response.status !== 405) {
          throw new Error(`Webhook health HTTP ${response.status}.`);
        }
      } finally {
        clearTimeout(timer);
      }
    } else {
      throw new Error("Teste LIVE ainda não implementado para este tipo.");
    }

    await prisma.notificationConnector.update({
      where: { id: connector.id },
      data: { lastTestAt: new Date(), lastTestStatus: "HEALTHY", lastError: null },
    });

    return NextResponse.json({ ok: true, message: "Conector validado com sucesso." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no teste.";

    await prisma.notificationConnector.update({
      where: { id: connector.id },
      data: { lastTestAt: new Date(), lastTestStatus: "ERROR", lastError: message },
    });

    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
