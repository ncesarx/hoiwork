import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getIncidentForOrganization } from "@/lib/incidents/lifecycle";

export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  const {session,organization}=await requireOrganization();
  const {id}=await context.params;
  const incident=await getIncidentForOrganization(organization.id,id);
  if(!incident) return NextResponse.json({ok:false,error:"Incidente não encontrado."},{status:404});
  if(incident.status==="RESOLVED") return NextResponse.json({ok:false,error:"Incidente resolvido não pode receber novo responsável."},{status:409});
  const body=await request.json().catch(()=>({})) as {assignedToId?:unknown;assignedToName?:unknown};
  const assignedToName=typeof body.assignedToName==="string"?body.assignedToName.trim().slice(0,160):"";
  const assignedToId=typeof body.assignedToId==="string"&&body.assignedToId.trim()?body.assignedToId.trim().slice(0,191):null;
  if(assignedToName.length<2) return NextResponse.json({ok:false,error:"Informe o responsável."},{status:400});
  const now=new Date(), actorName=session.user.name??session.user.email??"Operador";
  const changed=Boolean(incident.assignedToName||incident.assignedToId);
  const updated=await prisma.$transaction(async tx=>{
    const item=await tx.infrastructureIncident.update({where:{id:incident.id},data:{assignedToId,assignedToName,assignedAt:now}});
    await tx.infrastructureIncidentEvent.create({data:{
      organizationId:organization.id,incidentId:incident.id,eventType:changed?"OWNER_CHANGED":"OWNER_ASSIGNED",
      message:changed?`Responsável alterado para ${assignedToName}.`:`Incidente atribuído a ${assignedToName}.`,
      actorUserId:session.user.id,actorName,
      metadata:{previousAssignedToId:incident.assignedToId,previousAssignedToName:incident.assignedToName,assignedToId,assignedToName,assignedAt:now.toISOString()},
    }});
    return item;
  });
  return NextResponse.json({ok:true,assignedToName:updated.assignedToName,assignedAt:updated.assignedAt});
}
