import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { buildControlPlaneSloReport } from "@/lib/observability/control-plane-slo-report";

export async function GET(request:Request){
  const {organization}=await requireOrganization();
  const url=new URL(request.url);
  const hours=Math.max(1,Math.min(720,Number(url.searchParams.get("hours")??"24")));
  const report=await buildControlPlaneSloReport(organization.id,hours);
  return NextResponse.json({ok:true,...report},{headers:{"Cache-Control":"no-store","X-HOIWORK-Control-Plane-SLO":"015.6.11.7.3.2"}});
}
