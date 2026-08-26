import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getIncidentForOrganization } from "@/lib/incidents/lifecycle";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { session, organization } = await requireOrganization();
  const { id } = await context.params;
  const incident = await getIncidentForOrganization(organization.id, id);
  if (!incident) return NextResponse.json({ ok:false,error:"Incidente não encontrado." },{status:404});
  if (incident.status === "RESOLVED") return NextResponse.json({ok:false,error:"Incidente já resolvido."},{status:409});
  if (incident.acknowledgedAt) return NextResponse.json({ok:true,alreadyAcknowledged:true,acknowledgedAt:incident.acknowledgedAt});

  const now=new Date();
  const actorName=session.user.name ?? session.user.email ?? "Operador";
  const updated=await prisma.$transaction(async tx=>{
    const claim=await tx.infrastructureIncident.updateMany({
      where:{id:incident.id,organizationId:organization.id,acknowledgedAt:null,status:{not:"RESOLVED"}},
      data:{status:"ACKNOWLEDGED",acknowledgedAt:now,acknowledgedById:session.user.id,acknowledgedByName:actorName},
    });
    if (!claim.count) return null;
    await tx.infrastructureIncidentEvent.create({data:{
      organizationId:organization.id,incidentId:incident.id,eventType:"ACKNOWLEDGED",
      message:"Incidente reconhecido pela operação.",actorUserId:session.user.id,actorName,
      fromStatus:incident.status,toStatus:"ACKNOWLEDGED",
      metadata:{acknowledgedAt:now.toISOString(),nativeTimestamp:true},
    }});
    return tx.infrastructureIncident.findUnique({where:{id:incident.id}});
  });
  if (!updated) return NextResponse.json({ok:true,alreadyAcknowledged:true});
  return NextResponse.json({ok:true,acknowledgedAt:updated.acknowledgedAt,acknowledgedByName:updated.acknowledgedByName});
}
