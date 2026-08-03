const tickets = [
  ["CH-1048", "Validação do backup diário", "Em andamento", "Média"],
  ["CH-1041", "Acesso remoto para novo usuário", "Aberto", "Baixa"],
  ["CH-1029", "Atualização programada do servidor", "Resolvido", "Alta"],
];

export const metadata = { title: "Chamados | Portal", robots: { index: false, follow: false } };

export default function TicketsPage() {
  return (
    <>
      <section className="portal-heading">
        <span>Atendimento técnico</span>
        <h1>Chamados</h1>
        <p>Acompanhe solicitações, prioridades e andamento.</p>
      </section>
      <section className="portal-panel">
        <div className="portal-panel__header">
          <div><span>Central de suporte</span><h2>Solicitações recentes</h2></div>
          <button type="button">Abrir chamado</button>
        </div>
        <div className="portal-table">
          {tickets.map(([id, title, status, priority]) => (
            <div key={id}>
              <span><small>{id} • Prioridade {priority}</small><strong>{title}</strong></span>
              <b>{status}</b>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
