"use client";

import { useMemo, useState } from "react";

type Client = {
  name: string;
  city: "Lorena" | "Guaratinguetá" | "Piquete" | "Potim";
  category: string;
  cns?: string;
};

const clients: Client[] = [
  { name: "Tabelionato de Notas e Registro Civil das Pessoas Naturais de Piquete", city: "Piquete", category: "Tabelionato e Registro Civil", cns: "11.956-0" },
  { name: "Oficial de Registro Civil do 1º Subdistrito da Comarca de Guaratinguetá", city: "Guaratinguetá", category: "Registro Civil", cns: "11.455-3" },
  { name: "Oficial de Registro Civil do 2º Subdistrito da Comarca de Guaratinguetá", city: "Guaratinguetá", category: "Registro Civil", cns: "11.456-1" },
  { name: "Oficial de Registro Civil das Pessoas Naturais da Comarca de Lorena", city: "Lorena", category: "Registro Civil", cns: "11.458-7" },
  { name: "Tabelionato de Notas e Registro Civil do Município de Potim", city: "Potim", category: "Tabelionato e Registro Civil", cns: "12.012-1" },
  { name: "2º Tabelionato de Notas de Guaratinguetá", city: "Guaratinguetá", category: "Tabelionato de Notas" },
  { name: "1º Tabelionato de Notas de Guaratinguetá", city: "Guaratinguetá", category: "Tabelionato de Notas" },
  { name: "2º Tabelionato de Notas de Lorena", city: "Lorena", category: "Tabelionato de Notas" },
  { name: "1º Tabelionato de Notas de Lorena", city: "Lorena", category: "Tabelionato de Notas" },
  { name: "Registro de Imóveis de Guaratinguetá", city: "Guaratinguetá", category: "Registro de Imóveis" },
  { name: "Registro de Imóveis de Lorena", city: "Lorena", category: "Registro de Imóveis" },
];

const cities = ["Lorena", "Guaratinguetá", "Piquete", "Potim"] as const;

const methodology = [
  ["01", "Diagnóstico"],
  ["02", "Arquitetura"],
  ["03", "Implantação"],
  ["04", "Migração"],
  ["05", "Validação"],
  ["06", "Operação Assistida"],
  ["07", "Suporte Contínuo"],
];

const capabilities = [
  "Alta disponibilidade",
  "Disaster Recovery",
  "Backup imutável",
  "Virtualização",
  "Active Directory",
  "Microsoft 365",
  "Redes corporativas",
  "Firewall e VPN",
  "Monitoramento",
  "Continuidade operacional",
  "Segurança da informação",
  "Infraestrutura para cartórios",
];

export function CorporateTrust() {
  const [city, setCity] = useState<(typeof cities)[number]>("Lorena");
  const filtered = useMemo(() => clients.filter((client) => client.city === city), [city]);

  return (
    <section className="trust-platform" id="clientes">
      <div className="container">
        <header className="trust-platform__hero">
          <span>Corporate Trust</span>
          <h2>Instituições que confiam em nossas soluções.</h2>
          <p>
            Projetamos, implantamos e sustentamos ambientes críticos para cartórios e
            organizações que exigem disponibilidade, segurança e continuidade operacional.
          </p>
        </header>

        <div className="trust-platform__stats">
          <div><strong>{clients.length}</strong><span>instituições atendidas</span></div>
          <div><strong>{cities.length}</strong><span>municípios</span></div>
          <div><strong>Cartórios</strong><span>especialização setorial</span></div>
          <div><strong>Crítica</strong><span>infraestrutura e continuidade</span></div>
        </div>

        <section className="trust-clients">
          <div className="trust-heading">
            <span>Clientes reais</span>
            <h3>Experiência comprovada no segmento extrajudicial.</h3>
          </div>

          <div className="trust-clients__tabs">
            {cities.map((item) => (
              <button
                type="button"
                key={item}
                className={city === item ? "is-active" : ""}
                onClick={() => setCity(item)}
              >
                {item}
                <small>{clients.filter((client) => client.city === item).length}</small>
              </button>
            ))}
          </div>

          <div className="trust-clients__grid">
            {filtered.map((client) => (
              <article className="trust-client-card" key={client.name}>
                <div className="trust-client-card__mark">HO</div>
                <div>
                  <small>{client.category}</small>
                  <h4>{client.name}</h4>
                  <p>{client.city} • SP {client.cns ? <b>CNS {client.cns}</b> : null}</p>
                </div>
              </article>
            ))}
          </div>

          <p className="trust-clients__note">
            Publique nomes de clientes somente quando houver autorização ou base comercial adequada.
          </p>
        </section>

        <section className="trust-methodology">
          <div className="trust-heading">
            <span>Nossa metodologia</span>
            <h3>Do diagnóstico à evolução contínua.</h3>
          </div>
          <div className="trust-methodology__grid">
            {methodology.map(([number, title]) => (
              <article key={number}>
                <span>{number}</span>
                <h4>{title}</h4>
              </article>
            ))}
          </div>
        </section>

        <section className="trust-capabilities">
          <div className="trust-capabilities__copy">
            <span>Infraestrutura crítica</span>
            <h3>Especialistas no que mantém sua operação disponível.</h3>
            <p>
              Integramos tecnologia, processo e acompanhamento técnico para reduzir riscos
              e sustentar a continuidade do negócio.
            </p>
          </div>

          <div className="trust-capabilities__grid">
            {capabilities.map((item, index) => (
              <div key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="trust-operations">
          <div className="trust-heading">
            <span>Operations Center</span>
            <h3>Visibilidade contínua dos serviços essenciais.</h3>
          </div>

          <div className="trust-operations__grid">
            {[
              ["Cluster", "ONLINE"],
              ["Firewall", "ATIVO"],
              ["Storage", "SAUDÁVEL"],
              ["Backup", "CONCLUÍDO"],
              ["Replicação", "SINCRONIZADA"],
              ["Segurança", "PROTEGIDA"],
            ].map(([label, status]) => (
              <article key={label}>
                <span>{label}</span>
                <b>{status}</b>
                <i />
              </article>
            ))}
          </div>
          <p>Indicadores ilustrativos para apresentação institucional.</p>
        </section>

        <section className="trust-cta">
          <span>Próximo passo</span>
          <h3>Sua infraestrutura merece operar sem interrupções.</h3>
          <p>
            Comece com um diagnóstico técnico e identifique as prioridades de
            disponibilidade, segurança e recuperação.
          </p>
          <a href="#contato">Solicitar um diagnóstico <b>→</b></a>
        </section>
      </div>
    </section>
  );
}
