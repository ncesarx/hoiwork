import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/authz";
import { calculateRiskScore } from "@/lib/risk-score";
import { IntegrationActions } from "@/components/integrations/integration-actions";
import { DigitalTwinReal } from "@/components/integrations/digital-twin-real";

export const metadata={title:"Integrações | Portal Enterprise",robots:{index:false,follow:false}};

function formatDate(value:Date|null|undefined){
  return value?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(value):"Nunca";
}

export default async function Page(){
  const {organization}=await requireOrganization();
  const integration=await prisma.integration.findUnique({
    where:{organizationId_provider:{organizationId:organization.id,provider:"PROXMOX"}},
    include:{syncRuns:{orderBy:{startedAt:"desc"},take:5}},
  });

  const resources=integration?await prisma.integrationResource.findMany({
    where:{integrationId:integration.id},
    orderBy:[{kind:"asc"},{name:"asc"}],
  }):[];

  const [backup,dr,critical]=await Promise.all([
    prisma.backupJob.count({where:{organizationId:organization.id,status:{in:["COMPLETED","PROTECTED"]}}}),
    prisma.disasterRecoveryPlan.count({where:{organizationId:organization.id,replicationStatus:"SYNCHRONIZED"}}),
    prisma.ticket.count({where:{organizationId:organization.id,priority:"CRITICAL",status:{in:["OPEN","IN_PROGRESS"]}}}),
  ]);

  const healthy=resources.filter(r=>["ONLINE","RUNNING","AVAILABLE"].includes(r.status)).length;
  const risk=calculateRiskScore({
    resourceTotal:resources.length,resourceHealthy:healthy,backupHealthy:backup>0,
    drHealthy:dr>0,integrationHealthy:integration?.status==="HEALTHY",openCriticalTickets:critical
  });

  const serialized=resources.map(r=>({...r,
    memoryUsedBytes:r.memoryUsedBytes?.toString()??null,
    memoryTotalBytes:r.memoryTotalBytes?.toString()??null,
    diskUsedBytes:r.diskUsedBytes?.toString()??null,
    diskTotalBytes:r.diskTotalBytes?.toString()??null,
    uptimeSeconds:r.uptimeSeconds?.toString()??null,
  }));

  const mode=process.env.PROXMOX_DEMO_MODE==="true"?"DEMO":"LIVE";
  const endpoint=process.env.PROXMOX_BASE_URL??"Não configurado";
  const tls=process.env.PROXMOX_ALLOW_SELF_SIGNED==="true"?"Certificado autoassinado permitido":"Validação TLS estrita";

  return <>
    <section className="portal-heading"><span>Enterprise Integration Platform</span><h1>Proxmox VE & Digital Twin</h1><p>Diagnóstico, sincronização e visão operacional dos recursos reais do cluster.</p></section>

    <section className="integration-diagnostics">
      <article><span>Modo</span><strong>{mode}</strong></article>
      <article><span>Endpoint</span><strong>{endpoint}</strong></article>
      <article><span>TLS</span><strong>{tls}</strong></article>
      <article><span>Última sincronização</span><strong>{formatDate(integration?.lastSyncAt)}</strong></article>
    </section>

    <section className="risk-score">
      <div><span>Enterprise Risk Score</span><strong>{risk.score}<small>/100</small></strong><b>Risco {risk.level}</b></div>
      <div className="risk-score__components">{risk.components.map(c=><article key={c.name}><span>{c.name}</span><strong>{c.score}%</strong><i><em style={{width:`${c.score}%`}}/></i></article>)}</div>
    </section>

    <section className="integration-header">
      <div>
        <span>Conector Proxmox</span>
        <h2>{integration?.status??"NÃO CONFIGURADO"}</h2>
        <p>{integration?.lastError??"Nenhum erro registrado."}</p>
      </div>
      <IntegrationActions/>
    </section>

    {integration?.syncRuns?.length?<section className="integration-history">
      <div className="portal-panel__header"><div><span>Auditoria</span><h2>Últimas sincronizações</h2></div></div>
      {integration.syncRuns.map(run=><div key={run.id}>
        <span><strong>{run.status}</strong><small>{formatDate(run.startedAt)}</small></span>
        <span>{run.synchronizedCount}/{run.discoveredCount} recursos</span>
        <small>{run.errorMessage??"Sem erro"}</small>
      </div>)}
    </section>:null}

    <DigitalTwinReal resources={serialized}/>
  </>;
}
