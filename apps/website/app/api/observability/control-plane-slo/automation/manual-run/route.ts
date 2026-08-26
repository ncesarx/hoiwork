import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { runControlPlaneSloAutomation } from "@/lib/observability/control-plane-slo-automation";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(){const {session,organization}=await requireOrganization();if(!["ADMIN","TECHNICIAN"].includes(session.user.role))return NextResponse.json({ok:false,error:"Acesso negado."},{status:403});try{const result=await runControlPlaneSloAutomation({organizationId:organization.id,source:"MANUAL",respectEnabled:false});return NextResponse.json({ok:true,message:result.skipped?`Execução ignorada: ${result.reason}.`:`Snapshot ${result.snapshotId} capturado.`,result});}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Falha na execução manual do Control Plane SLO."},{status:500});}}
