import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { organization } = await requireOrganization();
  const policies = await prisma.alertPolicy.findMany({
    where: { organizationId: organization.id },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ ok: true, policies });
}

export async function POST(request: Request) {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const minSeverity = typeof body.minSeverity === "string" ? body.minSeverity : "HIGH";
  const channels = Array.isArray(body.channels) ? body.channels.filter((x: unknown) => typeof x === "string") : [];
  const recipients = Array.isArray(body.recipients) ? body.recipients.filter((x: unknown) => typeof x === "string" && x.trim()) : [];
  const escalateAfterMinutes = Number(body.escalateAfterMinutes ?? 30);
  const repeatEveryMinutes = Number(body.repeatEveryMinutes ?? 60);

  if (!name || !channels.length || !recipients.length) {
    return NextResponse.json(
      { ok: false, error: "Nome, canal e pelo menos um destinatário são obrigatórios." },
      { status: 400 },
    );
  }

  if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(minSeverity)) {
    return NextResponse.json({ ok: false, error: "Severidade mínima inválida." }, { status: 400 });
  }

  const policy = await prisma.alertPolicy.create({
    data: {
      organizationId: organization.id,
      name,
      minSeverity,
      channels,
      recipients,
      escalateAfterMinutes: Math.max(1, Math.trunc(escalateAfterMinutes)),
      repeatEveryMinutes: Math.max(1, Math.trunc(repeatEveryMinutes)),
    },
  });

  return NextResponse.json({ ok: true, policy }, { status: 201 });
}
