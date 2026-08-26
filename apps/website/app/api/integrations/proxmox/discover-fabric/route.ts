import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { discoverProxmoxFabric } from "@/integrations/discovery/fabric-engine";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(){let integrationId:string|undefined;try{const{session,organization}=await requireOrganization();if(!["ADMIN","TECHNICIAN"].includes(session.user.role))return NextResponse.json({ok:false,error:"Acesso permitido apenas para ADMIN ou TECHNICIAN."},{status:403});
 const integration=await prisma.integration.upsert({where:{organizationId_provider:{organizationId:organization.id,provider:"PROXMOX"}},update:{enabled:true,mode:"LIVE",lastError:null},create:{organizationId:organization.id,provider:"PROXMOX",name:"Proxmox VE",enabled:true,mode:"LIVE",status:"PENDING"}});integrationId=integration.id;
 const result=await discoverProxmoxFabric({organizationId:organization.id,integrationId:integration.id,userId:session.user.id});await prisma.integration.update({where:{id:integration.id},data:{status:"HEALTHY",lastSyncAt:new Date(),lastHealthAt:new Date(),lastError:null}});
 return NextResponse.json({ok:true,stage:"completed",message:`${result.verifiedCount} recurso(s) de storage/rede persistido(s) e verificado(s).`,...result},{headers:{"Cache-Control":"no-store","X-HOIWORK-Discovery":"015.6.3"}})
 }catch(error){const message=error instanceof Error?error.message:"Erro interno.";if(integrationId)await prisma.integration.update({where:{id:integrationId},data:{status:"ERROR",lastError:message}}).catch(()=>{});return NextResponse.json({ok:false,error:message},{status:500})}}
