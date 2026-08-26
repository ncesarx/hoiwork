import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const { organization } = await requireOrganization();

  const windows = await prisma.notificationMaintenanceWindow.findMany({
    where: { organizationId: organization.id },
    orderBy: { startsAt: "desc" },
  });

  return NextResponse.json({ ok: true, windows });
}

export async function POST(request: Request) {
  const { session, organization } = await requireOrganization();

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Somente ADMIN." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : null;
  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);

  if (!name || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return NextResponse.json({ ok: false, error: "Maintenance window inválida." }, { status: 400 });
  }

  const window = await prisma.notificationMaintenanceWindow.create({
    data: {
      organizationId: organization.id,
      name,
      reason,
      startsAt,
      endsAt,
      enabled: true,
    },
  });

  return NextResponse.json({ ok: true, window }, { status: 201 });
}
