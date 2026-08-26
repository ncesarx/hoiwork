import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const { organization } = await requireOrganization();

  const config = await prisma.discoveryAutomationConfig.upsert({
    where: { organizationId: organization.id },
    update: {},
    create: {
      organizationId: organization.id,
      enabled: false,
      intervalMinutes: 5,
      reconciliationEnabled: false,
    },
  });

  return NextResponse.json({ ok: true, config });
}

export async function POST(request: Request) {
  const { session, organization } = await requireOrganization();

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "Somente ADMIN pode alterar Discovery Automation." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));

  const enabled = Boolean(body.enabled);
  const reconciliationEnabled = Boolean(body.reconciliationEnabled);
  const intervalMinutes = Math.max(
    1,
    Math.min(1440, Math.trunc(Number(body.intervalMinutes ?? 5))),
  );

  const config = await prisma.discoveryAutomationConfig.upsert({
    where: { organizationId: organization.id },
    update: {
      enabled,
      intervalMinutes,
      reconciliationEnabled,
    },
    create: {
      organizationId: organization.id,
      enabled,
      intervalMinutes,
      reconciliationEnabled,
    },
  });

  return NextResponse.json({ ok: true, config });
}
