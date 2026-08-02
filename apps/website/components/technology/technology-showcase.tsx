"use client";

import { useMemo, useState } from "react";

type Technology = {
  id: string;
  name: string;
  category: "Infraestrutura" | "Cloud" | "Segurança" | "Backup";
  eyebrow: string;
  summary: string;
  capabilities: string[];
  accent: string;
};

const technologies: Technology[] = [
  {
    id: "microsoft",
    name: "Microsoft",
    category: "Infraestrutura",
    eyebrow: "Ecossistema corporativo",
    summary:
      "Windows Server, Active Directory, Microsoft 365 e Azure integrados para identidade, colaboração e continuidade.",
    capabilities: ["Windows Server", "Active Directory", "Microsoft 365", "Azure"],
    accent: "MS",
  },
  {
    id: "dell",
    name: "Dell Technologies",
    category: "Infraestrutura",
    eyebrow: "Compute e storage",
    summary:
      "Servidores, storages e plataformas empresariais dimensionadas para desempenho, disponibilidade e crescimento.",
    capabilities: ["PowerEdge", "Storage", "HCI", "ProSupport"],
    accent: "DT",
  },
  {
    id: "proxmox",
    name: "Proxmox",
    category: "Infraestrutura",
    eyebrow: "Virtualização e cluster",
    summary:
      "Clusters de virtualização, alta disponibilidade, replicação e administração centralizada para ambientes críticos.",
    capabilities: ["Virtualização", "Cluster HA", "Replicação", "Backup"],
    accent: "PX",
  },
  {
    id: "fortinet",
    name: "Fortinet",
    category: "Segurança",
    eyebrow: "Segurança de perímetro",
    summary:
      "Firewall de próxima geração, VPN, IPS, filtragem e segmentação para proteger usuários, dados e aplicações.",
    capabilities: ["NGFW", "VPN", "IPS", "Web Filter"],
    accent: "FT",
  },
  {
    id: "veeam",
    name: "Veeam",
    category: "Backup",
    eyebrow: "Proteção e recuperação",
    summary:
      "Backup, replicação, cópias imutáveis e recuperação orquestrada para reduzir riscos e acelerar a retomada.",
    capabilities: ["Backup", "Replicação", "Imutabilidade", "Recovery"],
    accent: "VM",
  },
  {
    id: "aws",
    name: "AWS",
    category: "Cloud",
    eyebrow: "Nuvem escalável",
    summary:
      "Serviços em nuvem para backup, aplicações, armazenamento e disaster recovery com arquitetura sob medida.",
    capabilities: ["EC2", "S3", "Cloud Backup", "Disaster Recovery"],
    accent: "AWS",
  },
  {
    id: "cisco",
    name: "Cisco",
    category: "Infraestrutura",
    eyebrow: "Redes corporativas",
    summary:
      "Switching, conectividade e segmentação para redes resilientes, performáticas e preparadas para expansão.",
    capabilities: ["Switching", "VLAN", "Core Network", "Redundância"],
    accent: "CS",
  },
  {
    id: "mikrotik",
    name: "MikroTik",
    category: "Infraestrutura",
    eyebrow: "Conectividade inteligente",
    summary:
      "Roteamento, VPN, balanceamento e conectividade para filiais, links redundantes e ambientes distribuídos.",
    capabilities: ["Routing", "VPN", "Failover", "SD-WAN"],
    accent: "MK",
  },
];

const categories = ["Todos", "Infraestrutura", "Cloud", "Segurança", "Backup"] as const;
type Category = (typeof categories)[number];

export function TechnologyShowcase() {
  const [category, setCategory] = useState<Category>("Todos");
  const [selectedId, setSelectedId] = useState("microsoft");

  const filtered = useMemo(
    () =>
      category === "Todos"
        ? technologies
        : technologies.filter((item) => item.category === category),
    [category],
  );

  const selected =
    technologies.find((item) => item.id === selectedId) ?? technologies[0];

  function changeCategory(next: Category) {
    setCategory(next);
    const first =
      next === "Todos"
        ? technologies[0]
        : technologies.find((item) => item.category === next);
    if (first) setSelectedId(first.id);
  }

  return (
    <section className="technology section" id="tecnologias">
      <div className="technology__orb technology__orb--one" aria-hidden="true" />
      <div className="technology__orb technology__orb--two" aria-hidden="true" />

      <div className="container">
        <div className="technology__header">
          <div className="section__intro technology__intro">
            <span>Ecossistema tecnológico</span>
            <h2>Tecnologias consolidadas, integradas ao seu negócio.</h2>
            <p>
              Selecionamos cada plataforma de acordo com o cenário, os riscos e
              os objetivos da operação — sem soluções genéricas.
            </p>
          </div>

          <div className="technology__filters" role="tablist" aria-label="Filtrar tecnologias">
            {categories.map((item) => (
              <button
                type="button"
                role="tab"
                aria-selected={category === item}
                className={
                  category === item
                    ? "technology__filter technology__filter--active"
                    : "technology__filter"
                }
                key={item}
                onClick={() => changeCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="technology__layout">
          <div className="technology__grid">
            {filtered.map((item) => {
              const active = item.id === selected.id;
              return (
                <button
                  type="button"
                  className={
                    active
                      ? "technology-card technology-card--active"
                      : "technology-card"
                  }
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  onMouseEnter={() => setSelectedId(item.id)}
                  onFocus={() => setSelectedId(item.id)}
                  aria-pressed={active}
                >
                  <span className="technology-card__mark">{item.accent}</span>
                  <span className="technology-card__copy">
                    <small>{item.category}</small>
                    <strong>{item.name}</strong>
                  </span>
                  <span className="technology-card__arrow">→</span>
                </button>
              );
            })}
          </div>

          <aside className="technology__detail" aria-live="polite">
            <div className="technology__detail-top">
              <span>{selected.eyebrow}</span>
              <b>{selected.category}</b>
            </div>

            <div className="technology__detail-brand">
              <span>{selected.accent}</span>
              <div>
                <small>Tecnologia selecionada</small>
                <h3>{selected.name}</h3>
              </div>
            </div>

            <p>{selected.summary}</p>

            <div className="technology__capabilities">
              {selected.capabilities.map((capability) => (
                <span key={capability}>{capability}</span>
              ))}
            </div>

            <a href="#contato" className="technology__cta">
              Avaliar para meu ambiente <span>→</span>
            </a>
          </aside>
        </div>

        <div className="technology__trust">
          <span>Arquitetura independente de fabricante</span>
          <span>Dimensionamento após diagnóstico</span>
          <span>Integração entre plataformas</span>
          <span>Suporte e evolução contínua</span>
        </div>
      </div>
    </section>
  );
}
