import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { captureControlPlaneHealthSnapshot } from "@/lib/observability/control-plane-slo-snapshots";

export async function POST(){
  const {session,organization}=await requireOrganization();
  if(session.user.role!=="ADMIN") return NextResponse.json({ok:false,error:"Somente ADMIN pode capturar snapshot."},{status:403});
  const snapshot=await captureControlPlaneHealthSnapshot(organization.id);
  return NextResponse.json({ok:true,version:"015.6.11.7.3.2",snapshot});
}
