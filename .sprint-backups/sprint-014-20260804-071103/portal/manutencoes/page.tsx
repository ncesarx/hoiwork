const events = [
  ["08/08/2026", "22:00", "Atualização de segurança", "Baixo"],
  ["15/08/2026", "20:30", "Teste de restauração", "Sem indisponibilidade prevista"],
];

export const metadata = { title: "Manutenções | Portal", robots: { index: false, follow: false } };

export default function MaintenancePage() {
  return (
    <>
      <section className="portal-heading">
        <span>Calendário técnico</span>
        <h1>Manutenções</h1>
        <p>Acompanhe intervenções programadas.</p>
      </section>
      <section className="portal-timeline">
        {events.map(([date, time, title, impact]) => (
          <article key={title}>
            <div><strong>{date}</strong><span>{time}</span></div><i />
            <div><h2>{title}</h2><p>Impacto previsto: {impact}</p></div>
          </article>
        ))}
      </section>
    </>
  );
}
