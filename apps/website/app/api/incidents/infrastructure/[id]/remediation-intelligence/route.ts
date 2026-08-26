import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { buildRemediationIntelligence } from "@/lib/incidents/remediation-intelligence";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { organization } = await requireOrganization();
  const { id } = await context.params;
  const data = await buildRemediationIntelligence(organization.id, id);
  if (!data) return NextResponse.json({ok:false,error:"Incidente não encontrado."},{status:404});
  return NextResponse.json({ok:true,...data},{headers:{"Cache-Control":"no-store","X-HOIWORK-Remediation-Intelligence":"015.6.11.5.1"}});
}
