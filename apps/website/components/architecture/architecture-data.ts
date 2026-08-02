import type { ArchitectureConnection, ArchitectureNode } from "./types";

export const architectureNodes: ArchitectureNode[] = [
  {
    id: "internet",
    kind: "internet",
    label: "Internet",
    eyebrow: "Conectividade",
    description:
      "Entrada redundante para os serviços externos e para o acesso seguro de usuários, filiais e parceiros.",
    benefits: ["Links redundantes", "Roteamento resiliente", "Baixa latência"],
    status: "Online",
    x: 50,
    y: 8,
  },
  {
    id: "firewall",
    kind: "firewall",
    label: "Firewall HA",
    eyebrow: "Segurança perimetral",
    description:
      "Camada de proteção em alta disponibilidade com políticas, VPN, inspeção e continuidade em caso de falha.",
    benefits: ["Failover", "VPN segura", "Proteção avançada"],
    status: "Ativo",
    x: 50,
    y: 27,
  },
  {
    id: "core",
    kind: "switch",
    label: "Core 10 Gb",
    eyebrow: "Rede corporativa",
    description:
      "Núcleo de rede preparado para tráfego crítico, segmentação e conexões redundantes entre os componentes.",
    benefits: ["VLANs", "Redundância", "Alta performance"],
    status: "Saudável",
    x: 50,
    y: 46,
  },
  {
    id: "cluster-a",
    kind: "cluster",
    label: "Proxmox 01",
    eyebrow: "Virtualização",
    description:
      "Primeiro nó do cluster corporativo, responsável por executar cargas Windows e Linux com alta disponibilidade.",
    benefits: ["Live migration", "Failover", "Escalabilidade"],
    status: "Online",
    x: 26,
    y: 66,
  },
  {
    id: "cluster-b",
    kind: "cluster",
    label: "Proxmox 02",
    eyebrow: "Virtualização",
    description:
      "Segundo nó do cluster, mantendo capacidade de processamento e continuidade durante falhas ou manutenções.",
    benefits: ["N+1", "Manutenção segura", "Recuperação rápida"],
    status: "Online",
    x: 50,
    y: 66,
  },
  {
    id: "storage",
    kind: "storage",
    label: "Storage",
    eyebrow: "Dados corporativos",
    description:
      "Camada de armazenamento protegida por redundância, monitoramento e políticas de desempenho.",
    benefits: ["RAID", "Snapshots", "Alta disponibilidade"],
    status: "Saudável",
    x: 74,
    y: 66,
  },
  {
    id: "backup",
    kind: "backup",
    label: "Backup Imutável",
    eyebrow: "Proteção de dados",
    description:
      "Cópias isoladas e protegidas contra alteração para reduzir o impacto de ransomware e falhas operacionais.",
    benefits: ["Imutabilidade", "Política 3-2-1", "Testes de restauração"],
    status: "Concluído",
    x: 38,
    y: 88,
  },
  {
    id: "dr",
    kind: "dr",
    label: "Site de DR",
    eyebrow: "Continuidade",
    description:
      "Ambiente secundário em outra localidade, preparado para recuperação conforme o RPO e o RTO do projeto.",
    benefits: ["Replicação", "Plano de contingência", "Operação remota"],
    status: "Sincronizado",
    x: 68,
    y: 88,
  },
];

export const architectureConnections: ArchitectureConnection[] = [
  { from: "internet", to: "firewall" },
  { from: "firewall", to: "core" },
  { from: "core", to: "cluster-a" },
  { from: "core", to: "cluster-b" },
  { from: "core", to: "storage" },
  { from: "cluster-a", to: "backup", tone: "secondary" },
  { from: "cluster-b", to: "backup", tone: "secondary" },
  { from: "storage", to: "dr", tone: "secondary" },
  { from: "backup", to: "dr" },
];
