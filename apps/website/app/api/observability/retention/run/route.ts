import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { runSloRetention } from "@/lib/observability/slo-reporting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const { session, organization } = await requireOrganization();
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ ok:false,error:"Somente ADMIN pode executar retenção." },{status:403});
  }
  const result = await runSloRetention(organization.id);
  return NextResponse.json({ ok:true,result });
}
