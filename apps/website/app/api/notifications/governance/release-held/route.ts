import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { releaseHeldTestDeliveries } from "@/lib/notifications/governance";

export async function POST(request: Request) {
  const { session, organization } = await requireOrganization();

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Somente ADMIN." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Number(body.limit ?? 1);

  const result = await releaseHeldTestDeliveries(organization.id, limit);

  return NextResponse.json({
    ok: true,
    message: `${result.released} entrega(s) HELD_TEST liberada(s) para PENDING.`,
    ...result,
  });
}
