import { getBackupJobs } from "@/lib/portal-data";
export const metadata={title:"Backup Center | Portal Enterprise",robots:{index:false,follow:false}};
export default async function Page(){
  const jobs=await getBackupJobs();
  return <><section className="portal-heading"><span>Persistência real</span><h1>Backup Center</h1><p>Jobs, retenção e última execução armazenados no banco.</p></section>
  <section className="data-backup">{jobs.map(j=><article key={j.id}><div><span>{j.kind}</span><b>{j.status}</b></div><h2>{j.name}</h2><p>Última execução: {j.lastRunAt ? new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(j.lastRunAt) : "Não executado"}</p><small>Retenção: {j.retentionDays ? `${j.retentionDays} dias` : "não informada"}</small><div className="data-progress"><i style={{width:`${j.progress}%`}}/></div></article>)}</section>
  {!jobs.length?<p className="data-empty">Nenhum job de backup cadastrado.</p>:null}</>;
}
