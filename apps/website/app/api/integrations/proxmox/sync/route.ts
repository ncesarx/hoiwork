import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { synchronizeIntegration } from "@/integrations/core/sync-engine";
import { getProxmoxConfigFromEnv, ProxmoxConnector } from "@/integrations/proxmox/client";
import { ProxmoxDemoConnector } from "@/integrations/proxmox/demo";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(){
  let integrationId:string|undefined;
  try{
    const {session,organization}=await requireOrganization();
    if(!["ADMIN","TECHNICIAN"].includes(session.user.role)){
      return NextResponse.json({ok:false,stage:"authorization",error:"Acesso negado."},{status:403});
    }

    const demo=process.env.PROXMOX_DEMO_MODE==="true";
    const integration=await prisma.integration.upsert({
      where:{organizationId_provider:{organizationId:organization.id,provider:"PROXMOX"}},
      update:{enabled:true,mode:demo?"DEMO":"LIVE",lastError:null},
      create:{organizationId:organization.id,provider:"PROXMOX",name:"Proxmox VE",enabled:true,mode:demo?"DEMO":"LIVE",status:"PENDING"},
    });
    integrationId=integration.id;

    const provider=demo?new ProxmoxDemoConnector():new ProxmoxConnector(getProxmoxConfigFromEnv());
    const health=await provider.health();
    if(!health.ok){
      await prisma.integration.update({where:{id:integration.id},data:{status:"ERROR",lastHealthAt:health.checkedAt,lastError:health.message}});
      return NextResponse.json({ok:false,stage:"health",error:health.message},{status:502});
    }

    const result=await synchronizeIntegration({organizationId:organization.id,integrationId:integration.id,provider});
    return NextResponse.json({ok:true,message:"Sincronização concluída.",resources:result.resources});
  }catch(error){
    const message=error instanceof Error?error.message:"Erro interno desconhecido.";
    if(integrationId){
      await prisma.integration.update({where:{id:integrationId},data:{status:"ERROR",lastError:message}}).catch(()=>{});
    }
    console.error("[Proxmox Sync]",error);
    return NextResponse.json({ok:false,stage:"sync",error:message},{status:500});
  }
}
