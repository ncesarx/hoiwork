import Link from "next/link";
import { getDashboardData } from "@/lib/portal-data";
import {
  COLLECTION_RECENT_MINUTES,
  formatCollectionTime,
  type CollectionFreshness,
} from "@/lib/inventory/freshness";

const isOperational = (status: string) =>
  ["ONLINE", "RUNNING"].includes(status.toUpperCase());

function freshnessLabel(freshness: CollectionFreshness) {
  switch (freshness) {
    case "RECENT": return "recente";
    case "STALE": return "antiga";
    case "NO_DATA": return "sem coleta";
    case "CLOCK_SKEW": return "horário divergente";
  }
}

export const metadata = { title:"Portal Enterprise", robots:{ index:false, follow:false } };

export default async function PortalPage(){
  const d = await getDashboardData();
  const recentEndpoints = d.proxmoxEndpoints.filter((endpoint) => endpoint.freshness === "RECENT").length;
  return <>
    <section className="portal-heading"><span>Enterprise Data Layer</span><h1>{d.organization.name}</h1><p>Indicadores consultados no PostgreSQL e isolados por organização.</p></section>
    <section className="data-stats">
      <article><strong>{d.assetCount}</strong><span>Recursos no inventário</span></article>
      <article><strong>{d.nodeCount}</strong><span>Nós Proxmox</span></article>
      <article><strong>{d.openTickets}</strong><span>Chamados ativos</span></article>
      <article><strong>{d.documentCount}</strong><span>Documentos</span></article>
      <article><strong>{d.contractCount}</strong><span>Contratos ativos</span></article>
    </section>
    <section className="data-dashboard-grid">
      <article className="portal-panel">
        <div className="portal-panel__header"><div><span>Inventário</span><h2>Infraestrutura</h2></div><Link href="/portal/inventario">Abrir inventário</Link></div>
        <div className="dashboard-freshness">
          <strong>
            Coleta Proxmox: {recentEndpoints} de {d.proxmoxEndpoints.length} endpoints recentes
            (até {COLLECTION_RECENT_MINUTES} min)
          </strong>
          {d.proxmoxEndpoints.length ? (
            <ul>
              {d.proxmoxEndpoints.map((endpoint) => (
                <li key={endpoint.id}>
                  {endpoint.name}: {freshnessLabel(endpoint.freshness)} · {formatCollectionTime(endpoint.lastSyncAt)}
                </li>
              ))}
            </ul>
          ) : <p>Nenhum endpoint Proxmox habilitado.</p>}
        </div>
        <div className="data-list">
          {d.assets.length ? d.assets.map((asset) => {
            const statusIsRecent = asset.source !== "Proxmox" || asset.freshness === "RECENT";
            const showOperational = statusIsRecent && isOperational(asset.status);
            return (
              <div key={asset.id}>
                <i className={showOperational ? "is-online" : "is-warning"} />
                <span>
                  <strong>{asset.name}</strong>
                  <small>
                    {asset.source} · {asset.type} · {asset.ipAddress ?? "IP não informado"}
                    {asset.observedAt && <> · visto em {formatCollectionTime(asset.observedAt)}</>}
                  </small>
                </span>
                <b className={showOperational ? "" : "is-warning"}>
                  {asset.status}
                  {asset.freshness && asset.freshness !== "RECENT" && ` · ${freshnessLabel(asset.freshness)}`}
                </b>
              </div>
            );
          }) : <p className="data-empty">Nenhum recurso encontrado. Consulte o Inventário e a última coleta.</p>}
        </div>
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
