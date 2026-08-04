import Link from "next/link";
import { getDashboardData } from "@/lib/portal-data";

export const metadata = { title:"Portal Enterprise", robots:{ index:false, follow:false } };

export default async function PortalPage(){
  const d = await getDashboardData();
  const availability = d.assetCount ? Math.round((d.onlineAssets/d.assetCount)*100) : 0;
  return <>
    <section className="portal-heading"><span>Enterprise Data Layer</span><h1>{d.organization.name}</h1><p>Indicadores consultados no PostgreSQL e isolados por organização.</p></section>
    <section className="data-stats">
      <article><strong>{d.assetCount}</strong><span>Ativos</span></article>
      <article><strong>{availability}%</strong><span>Online</span></article>
      <article><strong>{d.openTickets}</strong><span>Chamados ativos</span></article>
      <article><strong>{d.documentCount}</strong><span>Documentos</span></article>
      <article><strong>{d.contractCount}</strong><span>Contratos ativos</span></article>
    </section>
    <section className="data-dashboard-grid">
      <article className="portal-panel">
        <div className="portal-panel__header"><div><span>Banco de dados</span><h2>Infraestrutura</h2></div><Link href="/portal/inventario">Abrir inventário</Link></div>
        <div className="data-list">{d.assets.map(a=><div key={a.id}><i className={a.status==="ONLINE"?"is-online":"is-warning"}/><span><strong>{a.name}</strong><small>{a.type} • {a.ipAddress ?? "IP não informado"}</small></span><b>{a.status}</b></div>)}</div>
      </article>
      <article className="portal-panel">
        <div className="portal-panel__header"><div><span>Atendimento</span><h2>Chamados recentes</h2></div><Link href="/portal/chamados">Ver todos</Link></div>
        <div className="data-list">{d.tickets.length ? d.tickets.map(t=><div key={t.id}><span><strong>{t.title}</strong><small>{t.priority}</small></span><b>{t.status}</b></div>) : <p className="data-empty">Nenhum chamado.</p>}</div>
      </article>
    </section>
    <section className="portal-panel">
      <div className="portal-panel__header"><div><span>Serviços</span><h2>Contratos vigentes</h2></div><Link href="/portal/contratos">Detalhes</Link></div>
      <div className="data-contract-row">{d.contracts.length ? d.contracts.map(c=><article key={c.id}><span>{c.status}</span><strong>{c.name}</strong><small>Até {new Intl.DateTimeFormat("pt-BR").format(c.endsAt)}</small></article>) : <p className="data-empty">Nenhum contrato ativo.</p>}</div>
    </section>
  </>;
}
