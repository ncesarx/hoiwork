import { getDrPlan } from "@/lib/portal-data";
export const metadata={title:"Disaster Recovery | Portal Enterprise",robots:{index:false,follow:false}};
export default async function Page(){
  const plan=await getDrPlan();
  return <><section className="portal-heading"><span>Continuidade real</span><h1>Disaster Recovery</h1><p>RPO, RTO e replicação carregados do banco.</p></section>
  {plan?<><section className="data-dr"><div><span>Origem</span><h2>{plan.primarySite}</h2><b>{plan.primaryStatus}</b></div><div className="data-dr__flow"><i/><strong>{plan.replicationStatus}</strong><small>{plan.lastSyncAt ? new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(plan.lastSyncAt) : "Sem sincronização"}</small></div><div><span>Recuperação</span><h2>{plan.recoverySite}</h2><b>{plan.recoveryStatus}</b></div></section>
  <section className="data-dr-metrics"><article><span>RPO</span><strong>{plan.rpoMinutes} min</strong></article><article><span>RTO</span><strong>{plan.rtoMinutes} min</strong></article><article><span>Replicação</span><strong>{plan.replicationStatus}</strong></article></section></>:<p className="data-empty">Nenhum plano de DR cadastrado.</p>}</>;
}
