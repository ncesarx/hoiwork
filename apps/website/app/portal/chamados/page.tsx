import { TicketForm } from "@/components/portal-data/ticket-form";
import { getTickets } from "@/lib/portal-data";
export const metadata={title:"Chamados | Portal Enterprise",robots:{index:false,follow:false}};
type Props={searchParams:Promise<{status?:string}>};
export default async function Page({searchParams}:Props){
  const p=await searchParams; const tickets=await getTickets(p.status);
  return <><section className="portal-heading"><span>Persistência e auditoria</span><h1>Central de chamados</h1><p>Solicitações gravadas no banco e registradas na auditoria.</p></section>
  <section className="data-two-columns"><article className="portal-panel"><div className="portal-panel__header"><div><span>Novo atendimento</span><h2>Abrir chamado</h2></div></div><TicketForm/></article>
  <article className="portal-panel"><div className="portal-panel__header"><div><span>Histórico</span><h2>Solicitações</h2></div><form><select name="status" defaultValue={p.status??"ALL"}><option value="ALL">Todos</option><option value="OPEN">Abertos</option><option value="IN_PROGRESS">Em andamento</option><option value="RESOLVED">Resolvidos</option><option value="CLOSED">Fechados</option></select><button>Aplicar</button></form></div>
  <div className="data-ticket-list">{tickets.map(t=><article key={t.id}><div><span>{t.priority}</span><b>{t.status}</b></div><h3>{t.title}</h3><p>{t.description}</p><small>Aberto por {t.openedBy.name??t.openedBy.email}</small></article>)}</div></article></section></>;
}
