"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type NodeId =
  | "internet"
  | "firewall"
  | "core"
  | "cluster-a"
  | "cluster-b"
  | "storage"
  | "backup"
  | "dr";

type ArchitectureNode = {
  id: NodeId;
  label: string;
  eyebrow: string;
  image: string;
  status: string;
  description: string;
  benefits: string[];
  className: string;
};

const nodes: ArchitectureNode[] = [
  {
    id: "internet",
    label: "Internet Redundante",
    eyebrow: "Conectividade",
    image: "/architecture/internet-cloud.svg",
    status: "Online",
    description:
      "Links redundantes e rotas alternativas mantêm a conectividade disponível mesmo diante da falha de uma operadora.",
    benefits: ["Dois provedores", "Failover automático", "Acesso seguro"],
    className: "architecture-visual__node--internet",
  },
  {
    id: "firewall",
    label: "Firewall em HA",
    eyebrow: "Segurança perimetral",
    image: "/architecture/firewall-ha.svg",
    status: "Ativo",
    description:
      "Dois firewalls trabalham em alta disponibilidade, aplicando políticas, inspeção, VPN e continuidade de segurança.",
    benefits: ["Alta disponibilidade", "VPN e IPS", "Segmentação"],
    className: "architecture-visual__node--firewall",
  },
  {
    id: "core",
    label: "Core Switch 10 Gb",
    eyebrow: "Rede corporativa",
    image: "/architecture/core-switch.svg",
    status: "Saudável",
    description:
      "O núcleo da rede conecta os elementos críticos com alta capacidade, VLANs e caminhos redundantes.",
    benefits: ["Backbone 10 Gb", "VLANs", "Links redundantes"],
    className: "architecture-visual__node--core",
  },
  {
    id: "cluster-a",
    label: "Proxmox 01",
    eyebrow: "Cluster de virtualização",
    image: "/architecture/proxmox-node.svg",
    status: "Online",
    description:
      "Primeiro nó do cluster responsável por hospedar servidores Windows e Linux com mobilidade e alta disponibilidade.",
    benefits: ["Live migration", "Failover", "Escalabilidade"],
    className: "architecture-visual__node--cluster-a",
  },
  {
    id: "cluster-b",
    label: "Proxmox 02",
    eyebrow: "Cluster de virtualização",
    image: "/architecture/proxmox-node.svg",
    status: "Online",
    description:
      "Segundo nó mantém capacidade N+1 para falhas, atualizações e manutenções sem comprometer a operação.",
    benefits: ["Capacidade N+1", "Manutenção segura", "Recuperação rápida"],
    className: "architecture-visual__node--cluster-b",
  },
  {
    id: "storage",
    label: "Storage Corporativo",
    eyebrow: "Dados e desempenho",
    image: "/architecture/storage.svg",
    status: "Saudável",
    description:
      "Armazenamento central com redundância, snapshots, monitoramento e desempenho adequado às cargas críticas.",
    benefits: ["RAID", "Snapshots", "Baixa latência"],
    className: "architecture-visual__node--storage",
  },
  {
    id: "backup",
    label: "Backup Imutável",
    eyebrow: "Proteção de dados",
    image: "/architecture/immutable-backup.svg",
    status: "Concluído",
    description:
      "Cópias isoladas e protegidas contra alteração ajudam a recuperar dados após ransomware, erro humano ou falha.",
    benefits: ["Imutabilidade", "Estratégia 3-2-1", "Testes de restauração"],
    className: "architecture-visual__node--backup",
  },
  {
    id: "dr",
    label: "Site de Disaster Recovery",
    eyebrow: "Continuidade em outra cidade",
    image: "/architecture/dr-site.svg",
    status: "Sincronizado",
    description:
      "Ambiente secundário em outra localidade recebe réplicas e permite recuperação conforme os objetivos de RPO e RTO.",
    benefits: ["Replicação contínua", "Localidade remota", "Plano de contingência"],
    className: "architecture-visual__node--dr",
  },
];

const connections: Array<[NodeId, NodeId, string]> = [
  ["internet", "firewall", "M500 92 L500 192"],
  ["firewall", "core", "M500 225 L500 310"],
  ["core", "cluster-a", "M500 338 C430 360 335 365 255 410"],
  ["core", "cluster-b", "M500 338 L500 410"],
  ["core", "storage", "M500 338 C575 360 675 365 760 410"],
  ["cluster-a", "backup", "M255 505 C305 550 360 575 420 610"],
  ["cluster-b", "backup", "M500 505 C490 550 460 580 420 610"],
  ["storage", "dr", "M760 505 C735 550 690 580 650 620"],
  ["backup", "dr", "M420 650 L650 650"],
];

export function CorporateArchitecture() {
  const [activeId, setActiveId] = useState<NodeId>("firewall");
  const active = useMemo<ArchitectureNode>(
    () =>
      nodes.find((node) => node.id === activeId) ??
      nodes.find((node) => node.id === "firewall")!,
    [activeId],
  );

  return (
    <section className="architecture-visual section" id="arquitetura">
      <div className="container">
        <div className="architecture-visual__heading">
          <div className="section__intro">
            <span>Corporate Architecture Experience</span>
            <h2>Veja como construímos uma operação que não pode parar.</h2>
            <p>
              Passe o mouse ou selecione cada equipamento para explorar a
              função de cada camada da infraestrutura.
            </p>
          </div>

          <div className="architecture-visual__status">
            <div><i /> Ambiente demonstrativo</div>
            <span>Cluster <b>Online</b></span>
            <span>Firewall HA <b>Ativo</b></span>
            <span>Backup <b>Concluído</b></span>
            <span>Replicação <b>Sincronizada</b></span>
          </div>
        </div>

        <div className="architecture-visual__experience">
          <div className="architecture-visual__stage">
            <div className="architecture-visual__floor" aria-hidden="true" />
            <div className="architecture-visual__rack-light architecture-visual__rack-light--left" aria-hidden="true" />
            <div className="architecture-visual__rack-light architecture-visual__rack-light--right" aria-hidden="true" />

            <svg
              className="architecture-visual__links"
              viewBox="0 0 1000 720"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="visualGold" x1="0" x2="1">
                  <stop offset="0" stopColor="#7b5707" />
                  <stop offset=".5" stopColor="#f2bd35" />
                  <stop offset="1" stopColor="#7b5707" />
                </linearGradient>
                <filter id="visualGlow">
                  <feGaussianBlur stdDeviation="3" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              {connections.map(([from, to, pathData], index) => {
                const activePath = activeId === from || activeId === to;
                return (
                  <g
                    key={`${from}-${to}`}
                    className={
                      activePath
                        ? "architecture-visual__connection architecture-visual__connection--active"
                        : "architecture-visual__connection"
                    }
                  >
                    <path className="architecture-visual__path" d={pathData} />
                    <circle className="architecture-visual__packet" r="5">
                      <animateMotion
                        dur={`${3 + index * 0.22}s`}
                        repeatCount="indefinite"
                        path={pathData}
                      />
                    </circle>
                  </g>
                );
              })}
            </svg>

            {nodes.map((node) => {
              const selected = node.id === activeId;
              return (
                <button
                  type="button"
                  key={node.id}
                  className={`architecture-visual__node ${node.className}${selected ? " architecture-visual__node--active" : ""}`}
                  onMouseEnter={() => setActiveId(node.id)}
                  onFocus={() => setActiveId(node.id)}
                  onClick={() => setActiveId(node.id)}
                  aria-pressed={selected}
                >
                  <span className="architecture-visual__image">
                    <Image
                      src={node.image}
                      alt=""
                      width={240}
                      height={150}
                    />
                  </span>
                  <span className="architecture-visual__node-copy">
                    <small>{node.eyebrow}</small>
                    <strong>{node.label}</strong>
                    <em>{node.status}</em>
                  </span>
                </button>
              );
            })}
          </div>

          <aside className="architecture-visual__panel" aria-live="polite">
            <div className="architecture-visual__panel-label">
              <span>{active.eyebrow}</span>
              <b>{active.status}</b>
            </div>

            <div className="architecture-visual__panel-image">
              <Image
                src={active.image}
                alt={`Ilustração de ${active.label}`}
                width={240}
                height={150}
              />
            </div>

            <h3>{active.label}</h3>
            <p>{active.description}</p>

            <div className="architecture-visual__benefits">
              {active.benefits.map((benefit) => (
                <div key={benefit}><i>✓</i><span>{benefit}</span></div>
              ))}
            </div>

            <a href="#contato">
              Projetar esta arquitetura <span>→</span>
            </a>
          </aside>
        </div>

        <p className="architecture-visual__note">
          Representação ilustrativa. A topologia final, as tecnologias e os
          objetivos de recuperação são definidos após diagnóstico técnico.
        </p>
      </div>
    </section>
  );
}
