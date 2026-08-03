import { DigitalTwin } from "@/components/portal-enterprise/digital-twin";
import Link from "next/link";

const services = [
  ["Servidor Principal", "Infraestrutura", "Online"],
  ["Backup em Nuvem", "Backup", "Online"],
  ["Firewall Corporativo", "Segurança", "Online"],
  ["VPN Corporativa", "Conectividade", "Atenção"],
];

const tickets = [
  ["CH-1048", "Validação do backup diário", "Em andamento"],
  ["CH-1041", "Acesso remoto para novo usuário", "Aberto"],
  ["CH-1029", "Atualização programada do servidor", "Resolvido"],
];

export function PortalDashboard() {
  return (
    <>
      <section className="portal-heading">
        <span>Visão geral</span>
        <h1>Olá, Cliente Demonstração.</h1>
        <p>Acompanhe serviços, chamados, documentos e manutenções em um único ambiente.</p>
      </section>

      <section className="portal-stats">
        {[["4","Serviços monitorados"],["2","Chamados ativos"],["3","Documentos recentes"],["1","Manutenção programada"]].map(([value,label]) => (
          <article key={label}><strong>{value}</strong><span>{label}</span></article>
        ))}
      </section>

      <section className="portal-grid portal-grid-wide">
        <article className="portal-panel">
          <div className="portal-panel__header"><div><span>Status dos serviços</span><h2>Ambiente monitorado</h2></div><small>Atualização automática</small></div>
          <div className="portal-services">
            {services.map(([name,category,status]) => (
              <div key={name}>
                <i className={status === "Atenção" ? "warning" : ""} />
                <span><strong>{name}</strong><small>{category}</small></span>
                <b>{status}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="portal-panel">
          <div className="portal-panel__header"><div><span>Próxima janela</span><h2>Manutenção</h2></div></div>
          <div className="portal-maintenance">
            <span>08/08/2026</span><h3>Atualização de segurança</h3>
            <p>22:00 • Impacto previsto: baixo</p>
            <Link href="/portal/manutencoes">Ver calendário →</Link>
          </div>
        </article>
      </section>

      <section className="portal-panel">
        <div className="portal-panel__header"><div><span>Atendimento</span><h2>Chamados recentes</h2></div><Link href="/portal/chamados">Ver todos</Link></div>
        <div className="portal-table">
          {tickets.map(([id,title,status]) => (
            <div key={id}><span><small>{id}</small><strong>{title}</strong></span><b>{status}</b></div>
          ))}
        </div>
      </section>
          <DigitalTwin />
    </>
  );
}
