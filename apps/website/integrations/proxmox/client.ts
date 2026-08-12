import https from "node:https";
import type {
  DiscoveredResource,
  IntegrationHealth,
  IntegrationProvider,
} from "@/integrations/core/types";

type Envelope<T> = { data: T };

export type ProxmoxConfig = {
  baseUrl: string;
  tokenId: string;
  tokenSecret: string;
  allowSelfSigned: boolean;
};

export type ProxmoxVersion = {
  version?: string;
  release?: string;
  repoid?: string;
};

export type ProxmoxClusterEntry = {
  id?: string;
  name?: string;
  type?: string;
  node?: string;
  status?: string;
};

export type ProxmoxNode = {
  node: string;
  status?: string;
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  uptime?: number;
  level?: string;
  ssl_fingerprint?: string;
};

export type ProxmoxNodeStatus = {
  cpu?: number;
  cpuinfo?: {
    cores?: number;
    cpus?: number;
    model?: string;
    sockets?: number;
  };
  memory?: { used?: number; total?: number; free?: number };
  rootfs?: { used?: number; total?: number; free?: number };
  uptime?: number;
  pveversion?: string;
  loadavg?: string[];
  kversion?: string;
};

type Resource = {
  id: string;
  type: string;
  node?: string;
  vmid?: number;
  name?: string;
  status?: string;
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  uptime?: number;
  template?: number;
  tags?: string;
};

function required(value: string | undefined, name: string) {
  if (!value?.trim()) throw new Error(`${name} não configurada.`);
  return value.trim();
}

export function getProxmoxConfigFromEnv(): ProxmoxConfig {
  return {
    baseUrl: required(process.env.PROXMOX_BASE_URL, "PROXMOX_BASE_URL").replace(/\/$/, ""),
    tokenId: required(process.env.PROXMOX_TOKEN_ID, "PROXMOX_TOKEN_ID"),
    tokenSecret: required(process.env.PROXMOX_TOKEN_SECRET, "PROXMOX_TOKEN_SECRET"),
    allowSelfSigned: process.env.PROXMOX_ALLOW_SELF_SIGNED === "true",
  };
}

export class ProxmoxConnector implements IntegrationProvider {
  constructor(private readonly config: ProxmoxConfig) {}

  get endpoint() {
    return this.config.baseUrl;
  }

  private request<T>(path: string): Promise<T> {
    const url = new URL(`${this.config.baseUrl}/api2/json${path}`);

    return new Promise((resolve, reject) => {
      const started = Date.now();

      const req = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || "8006",
          path: `${url.pathname}${url.search}`,
          method: "GET",
          rejectUnauthorized: !this.config.allowSelfSigned,
          timeout: 15000,
          headers: {
            Authorization: `PVEAPIToken=${this.config.tokenId}=${this.config.tokenSecret}`,
            Accept: "application/json",
            "User-Agent": "HOIWORK-Discovery/1.0",
          },
        },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            const status = res.statusCode ?? 500;

            if (status < 200 || status >= 300) {
              reject(
                new Error(
                  `Proxmox API HTTP ${status}: ${
                    body || res.statusMessage || "erro sem corpo"
                  }`,
                ),
              );
              return;
            }

            try {
              const payload = JSON.parse(body) as Envelope<T>;
              resolve(payload.data);
            } catch {
              reject(
                new Error(
                  `Resposta inválida da API do Proxmox em ${path} (${Date.now() - started} ms).`,
                ),
              );
            }
          });
        },
      );

      req.on("timeout", () =>
        req.destroy(new Error(`Timeout ao acessar ${path} no Proxmox (15s).`)),
      );
      req.on("error", reject);
      req.end();
    });
  }

  async getVersion() {
    return this.request<ProxmoxVersion>("/version");
  }

  async getClusterStatus() {
    return this.request<ProxmoxClusterEntry[]>("/cluster/status");
  }

  async getNodes() {
    return this.request<ProxmoxNode[]>("/nodes");
  }

  async getNodeStatus(node: string) {
    return this.request<ProxmoxNodeStatus>(
      `/nodes/${encodeURIComponent(node)}/status`,
    );
  }

  async health(): Promise<IntegrationHealth> {
    try {
      const version = await this.getVersion();
      await this.getNodes();

      return {
        ok: true,
        message: `Proxmox conectado (${version.version ?? version.release ?? "versão detectada"}).`,
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Falha desconhecida.",
        checkedAt: new Date(),
      };
    }
  }

  async discover(): Promise<DiscoveredResource[]> {
    const [nodes, vms, storage] = await Promise.all([
      this.request<Resource[]>("/cluster/resources?type=node"),
      this.request<Resource[]>("/cluster/resources?type=vm"),
      this.request<Resource[]>("/cluster/resources?type=storage"),
    ]);

    return [...nodes, ...vms, ...storage]
      .filter((item) => item.template !== 1)
      .map((item) => ({
        externalId: item.id,
        kind:
          item.type === "qemu"
            ? "VM"
            : item.type === "lxc"
              ? "LXC"
              : item.type.toUpperCase(),
        name: item.name || item.node || item.id,
        status: (item.status || "unknown").toUpperCase(),
        node: item.node,
        cpuPercent:
          typeof item.cpu === "number"
            ? Math.round(item.cpu * 10000) / 100
            : undefined,
        memoryUsedBytes:
          typeof item.mem === "number"
            ? BigInt(Math.trunc(item.mem))
            : undefined,
        memoryTotalBytes:
          typeof item.maxmem === "number"
            ? BigInt(Math.trunc(item.maxmem))
            : undefined,
        diskUsedBytes:
          typeof item.disk === "number"
            ? BigInt(Math.trunc(item.disk))
            : undefined,
        diskTotalBytes:
          typeof item.maxdisk === "number"
            ? BigInt(Math.trunc(item.maxdisk))
            : undefined,
        uptimeSeconds:
          typeof item.uptime === "number"
            ? BigInt(Math.trunc(item.uptime))
            : undefined,
        metadata: {
          vmid: item.vmid,
          maxcpu: item.maxcpu,
          tags: item.tags,
        },
      }));
  }
}
