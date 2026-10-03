import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { getManualAssetHistory } from "@/lib/inventory/manual-asset-history";
import { ManualAssetError } from "@/lib/inventory/manual-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { session, organization, membership } = await requireOrganization();
  if (!["ADMIN", "TECHNICIAN"].includes(membership.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
  }
  const { id } = await context.params;
  try {
    const history = await getManualAssetHistory(organization.id, session.user.id, id);
    return NextResponse.json({ ok: true, ...history }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ManualAssetError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: "Não foi possível consultar o histórico." }, { status: 500 });
  }
}
