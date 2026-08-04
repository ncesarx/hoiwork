import { getAssets } from "@/lib/portal-data";
export const metadata={title:"Inventário | Portal Enterprise",robots:{index:false,follow:false}};
type Props={searchParams:Promise<{q?:string;type?:string}>};
export default async function Page({searchParams}:Props){
  const p=await searchParams; const assets=await getAssets(p.q,p.type);
  return <><section className="portal-heading"><span>Dados reais</span><h1>Inventário corporativo</h1><p>Pesquisa e filtros executados no PostgreSQL.</p></section>
  <form className="data-filters"><input name="q" defaultValue={p.q} placeholder="Pesquisar ativo, IP, modelo ou série"/><select name="type" defaultValue={p.type??"ALL"}><option value="ALL">Todos</option><option value="SERVER">Servidores</option><option value="FIREWALL">Firewalls</option><option value="SWITCH">Switches</option><option value="STORAGE">Storages</option></select><button>Filtrar</button></form>
  <section className="data-assets">{assets.map(a=><article key={a.id}><div><span>{a.type}</span><b>{a.status}</b></div><h2>{a.name}</h2><small>{a.id}</small><dl><div><dt>Fabricante</dt><dd>{a.manufacturer??"—"}</dd></div><div><dt>Modelo</dt><dd>{a.model??"—"}</dd></div><div><dt>IP</dt><dd>{a.ipAddress??"—"}</dd></div><div><dt>Localização</dt><dd>{a.location??"—"}</dd></div><div><dt>Série</dt><dd>{a.serialNumber??"—"}</dd></div></dl></article>)}</section>
  {!assets.length?<p className="data-empty">Nenhum ativo encontrado.</p>:null}</>;
}
