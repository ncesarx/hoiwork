import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const { organization } = await requireOrganization();
  const connectors = await prisma.notificationConnector.findMany({
    where: { organizationId: organization.id },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ ok: true, connectors });
}

export async function POST(request: Request) {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = typeof body.type === "string" ? body.type : "";
  const secretRef =
    typeof body.secretRef === "string" && body.secretRef.trim()
      ? body.secretRef.trim()
      : null;

  if (!name || !["EMAIL", "WEBHOOK", "WHATSAPP"].includes(type)) {
    return NextResponse.json({ ok: false, error: "Nome/tipo inválido." }, { status: 400 });
  }

  let config: Prisma.InputJsonValue = {};

  if (type === "WEBHOOK") {
    const url = typeof body.url === "string" ? body.url.trim() : "";
    config = { ...(url ? { url } : {}) };
  }

  if (type === "EMAIL") {
    const host = typeof body.host === "string" ? body.host.trim() : "";
    const port = Number(body.port ?? 587);
    const user = typeof body.user === "string" ? body.user.trim() : "";
    const from = typeof body.from === "string" ? body.from.trim() : "";
    const secure = Boolean(body.secure);
    const tlsServername =
      typeof body.tlsServername === "string" ? body.tlsServername.trim() : "";
    const rejectUnauthorized = body.rejectUnauthorized !== false;

    if (!host || !port || !from) {
      return NextResponse.json(
        { ok: false, error: "SMTP exige host, porta e remetente." },
        { status: 400 },
      );
    }

    config = {
      host,
      port,
      secure,
      user,
      from,
      tlsServername,
      rejectUnauthorized,
    };
  }

  const connector = await prisma.notificationConnector.create({
    data: {
      organizationId: organization.id,
      name,
      type,
      mode: "SIMULATED",
      secretRef,
      config,
      lastTestStatus: "PENDING",
    },
  });

  return NextResponse.json({ ok: true, connector }, { status: 201 });
}
