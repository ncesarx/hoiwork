import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const { organization } = await requireOrganization();

  const config = await prisma.notificationSloRetentionConfig.upsert({
    where: { organizationId: organization.id },
    update: {},
    create: {
      organizationId: organization.id,
      enabled: true,
      retentionDays: 90,
    },
  });

  return NextResponse.json({ ok: true, config });
}

export async function POST(request: Request) {
  const { session, organization } = await requireOrganization();

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "Somente ADMIN pode alterar retenção." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const enabled = Boolean(body.enabled);
  const retentionDays = Math.max(
    7,
    Math.min(3650, Math.trunc(Number(body.retentionDays ?? 90))),
  );

  const config = await prisma.notificationSloRetentionConfig.upsert({
    where: { organizationId: organization.id },
    update: { enabled, retentionDays },
    create: {
      organizationId: organization.id,
      enabled,
      retentionDays,
    },
  });

  return NextResponse.json({ ok: true, config });
}
