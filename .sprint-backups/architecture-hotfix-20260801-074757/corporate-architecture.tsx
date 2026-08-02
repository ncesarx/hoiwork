"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { architectureConnections, architectureNodes } from "./architecture-data";
import { TechnicalIcon } from "./technical-icon";

const statusItems = [
  ["Cluster", "Online"],
  ["Firewall HA", "Ativo"],
  ["Backup", "Concluído"],
  ["Replicação", "Sincronizada"],
];

export function CorporateArchitecture() {
  const [activeId, setActiveId] = useState("firewall");
  const reduceMotion = useReducedMotion();
  const active = useMemo(
    () => architectureNodes.find((node) => node.id === activeId) ?? architectureNodes[0],
    [activeId],
  );

  const nodeMap = useMemo(
    () => new Map(architectureNodes.map((node) => [node.id, node])),
    [],
  );

  return (
    <section className="architecture section" id="arquitetura">
      <div className="architecture__glow architecture__glow--one" />
      <div className="architecture__glow architecture__glow--two" />

      <div className="container">
        <div className="architecture__header">
          <div className="section__intro architecture__intro">
            <span>Arquitetura corporativa</span>
            <h2>Resiliência projetada em cada camada.</h2>
            <p>
              Explore uma infraestrutura de referência criada para segurança,
              alta disponibilidade, proteção de dados e recuperação de desastres.
            </p>
          </div>

          <div className="architecture__live" aria-label="Status ilustrativo da infraestrutura">
            <div className="architecture__live-title">
              <i /> Operação demonstrativa
            </div>
            {statusItems.map(([label, status]) => (
              <div className="architecture__live-row" key={label}>
                <span>{label}</span>
                <strong>{status}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="architecture__experience">
          <div className="architecture__canvas" aria-label="Diagrama interativo de infraestrutura corporativa">
            <div className="architecture__grid" />
            <svg className="architecture__connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="architectureGold" x1="0" x2="1">
                  <stop offset="0" stopColor="#8a6411" />
                  <stop offset="0.5" stopColor="#f2bd35" />
                  <stop offset="1" stopColor="#8a6411" />
                </linearGradient>
              </defs>
              {architectureConnections.map((connection, index) => {
                const from = nodeMap.get(connection.from);
                const to = nodeMap.get(connection.to);
                if (!from || !to) return null;
                const highlighted = activeId === connection.from || activeId === connection.to;
                return (
                  <g key={`${connection.from}-${connection.to}`}>
                    <motion.line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      className={highlighted ? "architecture__line architecture__line--active" : "architecture__line"}
                      initial={{ pathLength: reduceMotion ? 1 : 0, opacity: 0 }}
                      whileInView={{ pathLength: 1, opacity: 1 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{ delay: index * 0.08, duration: reduceMotion ? 0 : 0.8 }}
                    />
                    {!reduceMotion && (
                      <circle r="0.7" className={highlighted ? "architecture__packet architecture__packet--active" : "architecture__packet"}>
                        <animateMotion
                          dur={`${2.8 + index * 0.17}s`}
                          repeatCount="indefinite"
                          path={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
                        />
                      </circle>
                    )}
                  </g>
                );
              })}
            </svg>

            {architectureNodes.map((node, index) => {
              const isActive = activeId === node.id;
              return (
                <motion.button
                  type="button"
                  key={node.id}
                  className={isActive ? "architecture-node architecture-node--active" : "architecture-node"}
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  onMouseEnter={() => setActiveId(node.id)}
                  onFocus={() => setActiveId(node.id)}
                  onClick={() => setActiveId(node.id)}
                  aria-pressed={isActive}
                  initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.84 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.18 + index * 0.06, duration: reduceMotion ? 0 : 0.45 }}
                >
                  <span className="architecture-node__pulse" />
                  <span className="architecture-node__icon"><TechnicalIcon kind={node.kind} /></span>
                  <span className="architecture-node__copy">
                    <small>{node.eyebrow}</small>
                    <strong>{node.label}</strong>
                  </span>
                  <span className="architecture-node__status">{node.status}</span>
                </motion.button>
              );
            })}
          </div>

          <motion.aside
            className="architecture__panel"
            key={active.id}
            initial={{ opacity: 0, x: reduceMotion ? 0 : 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.26 }}
            aria-live="polite"
          >
            <div className="architecture__panel-topline">
              <span>{active.eyebrow}</span>
              <b>{active.status}</b>
            </div>
            <div className="architecture__panel-icon"><TechnicalIcon kind={active.kind} /></div>
            <h3>{active.label}</h3>
            <p>{active.description}</p>
            <div className="architecture__benefits">
              {active.benefits.map((benefit) => (
                <div key={benefit}><i>✓</i><span>{benefit}</span></div>
              ))}
            </div>
            <a href="#contato" className="architecture__panel-link">Projetar meu ambiente <span>→</span></a>
          </motion.aside>
        </div>

        <p className="architecture__disclaimer">
          Representação ilustrativa. A topologia, as tecnologias e os objetivos de recuperação são definidos após diagnóstico técnico.
        </p>
      </div>
    </section>
  );
}
