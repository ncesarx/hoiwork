import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { getProxmoxConfigFromEnv, ProxmoxConnector } from "@/integrations/proxmox/client";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(){
  try{
    const {session}=await requireOrganization();
    if(!["ADMIN","TECHNICIAN"].includes(session.user.role)){
      return NextResponse.json({ok:false,error:"Acesso negado."},{status:403});
    }
    if(process.env.PROXMOX_DEMO_MODE==="true"){
      return NextResponse.json({ok:true,mode:"DEMO",message:"Modo demonstração ativo."});
    }
    const config=getProxmoxConfigFromEnv();
    const result=await new ProxmoxConnector(config).health();
    return NextResponse.json({
      ok:result.ok,
      mode:"LIVE",
      message:result.message,
      endpoint:config.baseUrl,
      tls:config.allowSelfSigned?"SELF_SIGNED_ALLOWED":"STRICT",
    },{status:result.ok?200:502});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Erro desconhecido."},{status:500});
  }
}
