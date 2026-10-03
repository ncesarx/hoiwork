import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { createManualAsset, ManualAssetError } from "@/lib/inventory/manual-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { session, organization, membership } = await requireOrganization();
  if (!["ADMIN", "TECHNICIAN"].includes(membership.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
  }
  try {
    const asset = await createManualAsset(organization.id, session.user.id, await request.json().catch(() => null));
    return NextResponse.json({ ok: true, assetId: asset.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ManualAssetError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível cadastrar o equipamento." }, { status: 500 });
  }
}
