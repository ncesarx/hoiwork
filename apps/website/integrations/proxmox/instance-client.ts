import https from "node:https";

type Envelope<T> = { data: T };

export type InstanceConfig = {
  baseUrl: string;
  tokenId: string;
  tokenSecret: string;
  allowSelfSigned: boolean;
};

export type PveNode = {
  node: string;
  status?: string;
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  uptime?: number;
};

export type PveGuest = {
  id: string;
  type: "qemu" | "lxc";
  vmid: number;
  node: string;
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

export type PveStorage = {
  id: string;
  storage?: string;
  node?: string;
  type?: string;
  status?: string;
  disk?: number;
  maxdisk?: number;
  shared?: number;
  content?: string;
};

export type PveNetwork = {
  iface: string;
  type?: string;
  active?: number;
  autostart?: number;
  address?: string;
  cidr?: string;
  netmask?: string;
  gateway?: string;
  bridge_ports?: string;
  bridge_vlan_aware?: number;
  bond_slaves?: string;
  bond_mode?: string;
};

export class ProxmoxInstanceClient {
  constructor(private readonly config: InstanceConfig) {}

  private request<T>(path: string): Promise<T> {
    const url = new URL(`${this.config.baseUrl.replace(/\/$/, "")}/api2/json${path}`);

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || "8006",
          path: `${url.pathname}${url.search}`,
          method: "GET",
          timeout: 15000,
          rejectUnauthorized: !this.config.allowSelfSigned,
          headers: {
            Authorization: `PVEAPIToken=${this.config.tokenId}=${this.config.tokenSecret}`,
            Accept: "application/json",
            "User-Agent": "HOIWORK-Multi-Proxmox/1.0",
          },
        },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            const status = res.statusCode ?? 500;
            if (status < 200 || status >= 300) {
              reject(new Error(`Proxmox API HTTP ${status}: ${body || res.statusMessage || "erro sem corpo"}`));
              return;
            }

            try {
              resolve((JSON.parse(body) as Envelope<T>).data);
            } catch {
              reject(new Error(`Resposta inválida da API Proxmox em ${path}.`));
            }
          });
        },
      );

      req.on("timeout", () => req.destroy(new Error(`Timeout no endpoint ${path}.`)));
      req.on("error", reject);
      req.end();
    });
  }

  version() {
    return this.request<Record<string, unknown>>("/version");
  }

  nodes() {
    return this.request<PveNode[]>("/nodes");
  }

  guests() {
    return this.request<PveGuest[]>("/cluster/resources?type=vm");
  }

  storages() {
    return this.request<PveStorage[]>("/cluster/resources?type=storage");
  }

  network(node: string) {
    return this.request<PveNetwork[]>(`/nodes/${encodeURIComponent(node)}/network`);
  }
}
