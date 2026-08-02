export type ArchitectureNodeKind =
  | "internet"
  | "firewall"
  | "switch"
  | "cluster"
  | "storage"
  | "backup"
  | "dr";

export type ArchitectureNode = {
  id: string;
  kind: ArchitectureNodeKind;
  label: string;
  eyebrow: string;
  description: string;
  benefits: string[];
  status: string;
  x: number;
  y: number;
};

export type ArchitectureConnection = {
  from: string;
  to: string;
  tone?: "primary" | "secondary";
};
