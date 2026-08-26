import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const { organization } = await requireOrganization();

  const config = await prisma.notificationAutomationConfig.upsert({
    where: { organizationId: organization.id },
    update: {},
    create: {
      organizationId: organization.id,
      enabled: false,
      intervalMinutes: 5,
    },
  });

  return NextResponse.json({ ok: true, config });
}

export async function POST(request: Request) {
  const { session, organization } = await requireOrganization();

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "Somente ADMIN pode alterar automação." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const enabled = Boolean(body.enabled);
  const intervalMinutes = Math.max(
    1,
    Math.min(1440, Math.trunc(Number(body.intervalMinutes ?? 5))),
  );

  const config = await prisma.notificationAutomationConfig.upsert({
    where: { organizationId: organization.id },
    update: {
      enabled,
      intervalMinutes,
    },
    create: {
      organizationId: organization.id,
      enabled,
      intervalMinutes,
    },
  });

  return NextResponse.json({ ok: true, config });
}
