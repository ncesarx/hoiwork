import https from "node:https";

type Envelope<T> = { data: T };

type Config = {
  baseUrl: string;
  tokenId: string;
  tokenSecret: string;
  allowSelfSigned: boolean;
};

export type GuestResource = {
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
  pool?: string;
  lock?: string;
};

export type GuestStatus = {
  name?: string;
  status?: string;
  vmid?: number;
  cpu?: number;
  cpus?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  uptime?: number;
  pid?: number;
  qmpstatus?: string;
  tags?: string;
  lock?: string;
};

function required(value: string | undefined, name: string) {
  if (!value?.trim()) throw new Error(`${name} não configurada.`);
  return value.trim();
}

function configFromEnv(): Config {
  return {
    baseUrl: required(process.env.PROXMOX_BASE_URL, "PROXMOX_BASE_URL").replace(/\/$/, ""),
    tokenId: required(process.env.PROXMOX_TOKEN_ID, "PROXMOX_TOKEN_ID"),
    tokenSecret: required(process.env.PROXMOX_TOKEN_SECRET, "PROXMOX_TOKEN_SECRET"),
    allowSelfSigned: process.env.PROXMOX_ALLOW_SELF_SIGNED === "true",
  };
}

export class ProxmoxGuestClient {
  private readonly config = configFromEnv();

  private request<T>(path: string): Promise<T> {
    const url = new URL(`${this.config.baseUrl}/api2/json${path}`);

    return new Promise((resolve, reject) => {
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
            "User-Agent": "HOIWORK-Virtual-Discovery/1.0",
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

  async getGuests() {
    const resources = await this.request<GuestResource[]>("/cluster/resources?type=vm");
    return resources.filter(
      (item) => (item.type === "qemu" || item.type === "lxc") && item.template !== 1,
    );
  }

  async getStatus(guest: GuestResource) {
    const kind = guest.type === "qemu" ? "qemu" : "lxc";
    return this.request<GuestStatus>(
      `/nodes/${encodeURIComponent(guest.node)}/${kind}/${guest.vmid}/status/current`,
    );
  }
}
