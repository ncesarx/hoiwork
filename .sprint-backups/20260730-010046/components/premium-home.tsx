import Image from "next/image";

const services = [
  {
    icon: "▤",
    title: "Infraestrutura",
    text: "Servidores, redes, virtualização e storage para ambientes de missão crítica.",
  },
  {
    icon: "☁",
    title: "Cloud Computing",
    text: "Soluções em nuvem seguras, escaláveis e integradas à sua operação.",
  },
  {
    icon: "◇",
    title: "Segurança",
    text: "Proteção de dados, endpoints, acessos e sistemas essenciais.",
  },
  {
    icon: "◉",
    title: "Suporte Especializado",
    text: "Atendimento técnico próximo, organizado e orientado à continuidade.",
  },
];

const stats = [
  ["350+", "clientes atendidos"],
  ["99,98%", "disponibilidade"],
  ["24/7", "monitoramento"],
  ["15 anos", "experiência"],
];

export function PremiumHome() {
  return (
    <div className="site">
      <header className="navbar">
        <div className="container navbar__inner">
          <a href="#" className="brand" aria-label="Home & Office">
            <Image
              src="/brand/logo-premium.png"
              alt="Home & Office Tech Solutions"
              width={520}
              height={150}
              priority
            />
          </a>

          <nav className="navlinks" aria-label="Navegação principal">
            <a href="#empresa">Empresa</a>
            <a href="#solucoes">Soluções</a>
            <a href="#cartorios">Cartórios</a>
            <a href="#contato">Contato</a>
          </nav>

          <a className="button button--gold navbar__cta" href="#contato">
            Solicitar diagnóstico
          </a>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero__overlay" />
          <div className="container hero__content">
            <div className="pill">Infraestrutura • Cloud • Segurança • Suporte</div>
            <h1>
              Parceria em <span>soluções</span>
              <br />
              para sua empresa
            </h1>
            <p>
              Tecnologia corporativa para elevar a disponibilidade, proteger
              dados e transformar sua operação de TI em uma vantagem
              competitiva.
            </p>

            <div className="hero__actions">
              <a className="button button--gold" href="#solucoes">
                Nossas soluções
              </a>
              <a className="button button--glass" href="#contato">
                Fale com um especialista
              </a>
            </div>
          </div>
        </section>

        <section className="container stats" aria-label="Indicadores">
          {stats.map(([value, label]) => (
            <div className="stat" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>

        <section className="section" id="solucoes">
          <div className="container">
            <div className="section__intro">
              <span>Nossas soluções</span>
              <h2>Uma base tecnológica segura para sua empresa evoluir.</h2>
              <p>
                Serviços integrados para continuidade, produtividade e
                segurança, com uma única equipe acompanhando todo o ambiente.
              </p>
            </div>

            <div className="cards">
              {services.map((service) => (
                <article className="card" key={service.title}>
                  <div className="card__icon">{service.icon}</div>
                  <h3>{service.title}</h3>
                  <p>{service.text}</p>
                  <a href="#contato">Saiba mais →</a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--muted" id="cartorios">
          <div className="container split">
            <div>
              <span className="eyebrow">Soluções especializadas</span>
              <h2>Infraestrutura crítica para cartórios que não podem parar.</h2>
              <p>
                Alta disponibilidade, backup contínuo, replicação e recuperação
                de desastres para manter os serviços essenciais sempre
                disponíveis.
              </p>
              <a className="button button--gold" href="#contato">
                Solicitar avaliação técnica
              </a>
            </div>

            <div className="checklist">
              {[
                "Alta disponibilidade",
                "Backup e replicação",
                "Disaster Recovery",
                "Segurança e LGPD",
                "Monitoramento 24/7",
                "Continuidade operacional",
              ].map((item) => (
                <div key={item}>
                  <b>✓</b>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="contato">
          <div className="container split">
            <div className="section__intro">
              <span>Contato</span>
              <h2>Fale com um especialista.</h2>
              <p>
                Conte-nos sobre seu ambiente e receba uma orientação inicial
                para os próximos passos.
              </p>
            </div>

            <form className="contact">
              <input type="text" placeholder="Nome completo" required />
              <input type="email" placeholder="E-mail corporativo" required />
              <input type="text" placeholder="Empresa" />
              <textarea rows={5} placeholder="Como podemos ajudar?" required />
              <button className="button button--gold" type="submit">
                Enviar mensagem
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <strong>Home & Office Tech Solutions</strong>
          <span>Infraestrutura • Cloud • Segurança • Suporte</span>
        </div>
      </footer>
    </div>
  );
}
