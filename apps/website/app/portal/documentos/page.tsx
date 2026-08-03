const documents = [
  ["Arquitetura", "Diagrama de Infraestrutura", "30/07/2026"],
  ["Continuidade", "Plano de Backup e Recuperação", "28/07/2026"],
  ["Relatórios", "Relatório Técnico Mensal", "01/08/2026"],
];

export const metadata = { title: "Documentos | Portal", robots: { index: false, follow: false } };

export default function DocumentsPage() {
  return (
    <>
      <section className="portal-heading">
        <span>Central técnica</span>
        <h1>Documentos</h1>
        <p>Relatórios, diagramas e planos técnicos.</p>
      </section>
      <section className="portal-document-grid">
        {documents.map(([category, name, date]) => (
          <article className="portal-document" key={name}>
            <span>▤</span><small>{category}</small><h2>{name}</h2>
            <p>Atualizado em {date}</p><button type="button">Visualizar</button>
          </article>
        ))}
      </section>
    </>
  );
}
