import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { ManualAssetError, updateManualAsset } from "@/lib/inventory/manual-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { session, organization, membership } = await requireOrganization();
  if (!["ADMIN", "TECHNICIAN"].includes(membership.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
  }
  const { id } = await context.params;
  try {
    const asset = await updateManualAsset(organization.id, session.user.id, id, await request.json().catch(() => null));
    return NextResponse.json({ ok: true, assetId: asset.id, updatedAt: asset.updatedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ManualAssetError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível editar o equipamento." }, { status: 500 });
  }
}
