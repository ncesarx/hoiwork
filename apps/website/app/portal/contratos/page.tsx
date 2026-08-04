import { getContracts } from "@/lib/portal-data";
export const metadata={title:"Contratos | Portal Enterprise",robots:{index:false,follow:false}};
export default async function Page(){
  const contracts=await getContracts();
  return <><section className="portal-heading"><span>Dados reais</span><h1>Contratos</h1><p>Vigência e SLA consultados no PostgreSQL.</p></section>
  <section className="data-contracts">{contracts.map(c=><article key={c.id}><div><span>{c.id}</span><b>{c.status}</b></div><h2>{c.name}</h2><dl><div><dt>Início</dt><dd>{new Intl.DateTimeFormat("pt-BR").format(c.startsAt)}</dd></div><div><dt>Término</dt><dd>{new Intl.DateTimeFormat("pt-BR").format(c.endsAt)}</dd></div><div><dt>SLA</dt><dd>{c.slaHours ? `${c.slaHours} horas` : "—"}</dd></div><div><dt>Horas mensais</dt><dd>{c.monthlyHours ?? "—"}</dd></div></dl></article>)}</section>
  {!contracts.length?<p className="data-empty">Nenhum contrato cadastrado.</p>:null}</>;
}
