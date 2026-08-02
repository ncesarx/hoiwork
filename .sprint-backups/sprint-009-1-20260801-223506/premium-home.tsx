"use client";

import Image from "next/image";
import { CorporateArchitecture } from "./architecture/corporate-architecture";
import { TechnologyShowcase } from "./technology/technology-showcase";
import { CorporateTrust } from "./trust/corporate-trust";

const services = [
  ["▤", "Infraestrutura", "Ambientes robustos, escaláveis e de alta disponibilidade."],
  ["☁", "Cloud", "Soluções em nuvem seguras e eficientes para sua empresa."],
  ["◇", "Segurança", "Proteção completa dos seus dados e sistemas críticos."],
  ["◉", "Suporte", "Atendimento especializado quando e onde você precisar."],
];
const capabilities = [
  ["◇", "Segurança", "Proteção completa dos seus dados e sistemas."],
  ["☁", "Cloud", "Soluções em nuvem escaláveis e eficientes."],
  ["◉", "Suporte", "Atendimento especializado quando você precisar."],
  ["▥", "Performance", "Alta disponibilidade e máximo desempenho."],
];
const stats = [["+150", "Clientes atendidos"],["+390", "Servidores gerenciados"],["99,9%", "Uptime garantido"],["24/7", "Suporte especializado"]];

export function PremiumHome() {
  return <div className="site">
    <header className="navbar"><div className="container navbar__inner">
      <a href="#inicio" className="brand" aria-label="Home & Office Tech Solutions"><Image src="/brand/logo-original.jpg" alt="Home & Office Tech Solutions" width={346} height={90} priority /></a>
      <nav className="navlinks" aria-label="Navegação principal"><a href="#empresa">Empresa</a><a href="#solucoes">Soluções</a><a href="#cartorios">Cartórios</a><a href="#arquitetura">Arquitetura</a><a href="#contato">Contato</a></nav>
      <a className="button button--outline navbar__cta" href="#contato">Fale com especialista <span>→</span></a>
    </div></header>
    <main id="inicio">
      <section className="hero">
        <div className="hero__background" aria-hidden="true" />
        <div className="container hero__grid">
          <div className="hero__copy"><div className="pill">Infraestrutura • Cloud • Segurança • Suporte</div><h1>Parceria em <span>soluções</span><br/>para sua empresa</h1><p>Tecnologia corporativa para elevar a disponibilidade, proteger dados e transformar sua operação de TI em uma vantagem competitiva.</p><div className="hero__actions"><a className="button button--gold" href="#solucoes">Nossas soluções <span>→</span></a><a className="button button--outline" href="#contato">Fale com especialista <span>→</span></a></div></div>
          <aside className="capability-panel" aria-label="Principais capacidades">{capabilities.map(([icon,title,text])=><div className="capability" key={title}><i>{icon}</i><div><strong>{title}</strong><p>{text}</p></div></div>)}</aside>
        </div>
      </section>
      <section className="container stats" aria-label="Indicadores">{stats.map(([v,l],i)=><div className="stat" key={l}><i>{["◎","▤","◇","◉"][i]}</i><div><strong>{v}</strong><span>{l}</span></div></div>)}</section>
      <section className="section section--solutions" id="solucoes"><div className="container"><div className="section__intro section__intro--center"><span>Nossas soluções</span><h2>Tecnologia completa para impulsionar seu negócio</h2></div><div className="cards">{services.map(([icon,title,text])=><article className="card" key={title}><div className="card__title"><i>{icon}</i><h3>{title}</h3></div><p>{text}</p><a href="#contato">Saiba mais →</a></article>)}</div></div></section>
      <section id="arquitetura"><CorporateArchitecture /></section>
      <TechnologyShowcase />
      <CorporateTrust />

      <section className="section section--muted" id="cartorios"><div className="container split"><div><span className="eyebrow">Soluções especializadas</span><h2>Infraestrutura crítica para cartórios que não podem parar.</h2><p>Alta disponibilidade, backup contínuo, replicação e recuperação de desastres para manter os serviços essenciais sempre disponíveis.</p><a className="button button--gold" href="#contato">Solicitar avaliação técnica</a></div><div className="checklist">{["Alta disponibilidade","Backup e replicação","Disaster Recovery","Segurança e LGPD","Monitoramento 24/7","Continuidade operacional"].map(x=><div key={x}><b>✓</b><span>{x}</span></div>)}</div></div></section>
      <section className="section" id="contato"><div className="container split"><div className="section__intro"><span>Contato</span><h2>Fale com um especialista.</h2><p>Conte-nos sobre seu ambiente e receba uma orientação inicial para os próximos passos.</p></div><form className="contact"><input type="text" placeholder="Nome completo" required/><input type="email" placeholder="E-mail corporativo" required/><input type="text" placeholder="Empresa"/><textarea rows={5} placeholder="Como podemos ajudar?" required/><button className="button button--gold" type="submit">Enviar mensagem</button></form></div></section>
    </main>
    <footer className="footer"><div className="container footer__inner"><strong>Home & Office Tech Solutions</strong><span>Infraestrutura • Cloud • Segurança • Suporte</span></div></footer>
  </div>;
}
