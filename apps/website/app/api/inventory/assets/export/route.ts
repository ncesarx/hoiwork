import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { exportManualAssets } from "@/lib/inventory/manual-asset-export";
import { ManualAssetError } from "@/lib/inventory/manual-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { session, organization, membership } = await requireOrganization();
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!["ADMIN", "TECHNICIAN"].includes(membership.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403, headers });
  }
  const params = new URL(request.url).searchParams;
  try {
    const csv = await exportManualAssets(organization.id, session.user.id, { q: params.get("q") ?? "", type: params.get("type") ?? "ALL" });
    return new Response(csv, { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="hoiwork-equipamentos-manuais.csv"' } });
  } catch (error) {
    if (error instanceof ManualAssetError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status, headers });
    return NextResponse.json({ ok: false, error: "Não foi possível exportar os equipamentos." }, { status: 500, headers });
  }
}
