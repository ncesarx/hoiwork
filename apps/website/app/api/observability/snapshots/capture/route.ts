import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { captureSloSnapshot } from "@/lib/observability/slo-snapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
  }

  try {
    const snapshot = await captureSloSnapshot(organization.id);
    return NextResponse.json({ ok: true, snapshot }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao capturar snapshot." },
      { status: 500 },
    );
  }
}
