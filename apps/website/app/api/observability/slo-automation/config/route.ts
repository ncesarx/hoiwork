import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const { organization } = await requireOrganization();

  const config = await prisma.notificationSloAutomationConfig.upsert({
    where: { organizationId: organization.id },
    update: {},
    create: {
      organizationId: organization.id,
      enabled: false,
      intervalMinutes: 15,
    },
  });

  return NextResponse.json({ ok: true, config });
}

export async function POST(request: Request) {
  const { session, organization } = await requireOrganization();

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "Somente ADMIN pode alterar SLO Automation." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));

  const enabled = Boolean(body.enabled);
  const intervalMinutes = Math.max(
    5,
    Math.min(1440, Math.trunc(Number(body.intervalMinutes ?? 15))),
  );

  const nocDegradedBelow = Math.max(
    1,
    Math.min(100, Math.trunc(Number(body.nocDegradedBelow ?? 90))),
  );

  const nocCriticalBelow = Math.max(
    0,
    Math.min(
      nocDegradedBelow - 1,
      Math.trunc(Number(body.nocCriticalBelow ?? 70)),
    ),
  );

  const burnDegradedAt = Math.max(0.1, Number(body.burnDegradedAt ?? 2));
  const burnCriticalAt = Math.max(
    burnDegradedAt,
    Number(body.burnCriticalAt ?? 10),
  );

  const config = await prisma.notificationSloAutomationConfig.upsert({
    where: { organizationId: organization.id },
    update: {
      enabled,
      intervalMinutes,
      nocDegradedBelow,
      nocCriticalBelow,
      burnDegradedAt,
      burnCriticalAt,
    },
    create: {
      organizationId: organization.id,
      enabled,
      intervalMinutes,
      nocDegradedBelow,
      nocCriticalBelow,
      burnDegradedAt,
      burnCriticalAt,
    },
  });

  return NextResponse.json({ ok: true, config });
}
