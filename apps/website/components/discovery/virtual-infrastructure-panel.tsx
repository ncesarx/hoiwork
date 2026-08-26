import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/authz";
import { VirtualDiscoveryConsole } from "@/components/discovery/virtual-discovery-console";

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "—";
}

function formatBytes(value: bigint | null | undefined) {
  if (value == null) return "—";
  let size = Number(value);
  if (!Number.isFinite(size)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit >= 3 ? 1 : 0)} ${units[unit]}`;
}

function formatUptime(value: bigint | null | undefined) {
  if (value == null) return "—";
  const total = Number(value);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  return `${days}d ${hours}h`;
}

export async function VirtualInfrastructurePanel() {
  const { organization } = await requireOrganization();

  const [guests, latestRun] = await Promise.all([
    prisma.infrastructureAsset.findMany({
      where: {
        organizationId: organization.id,
        provider: "PROXMOX",
        assetType: { in: ["VM", "LXC"] },
      },
      orderBy: [
        { active: "desc" },
        { assetType: "asc" },
        { name: "asc" },
      ],
    }),
    prisma.discoveryRun.findFirst({
      where: {
        organizationId: organization.id,
        provider: "PROXMOX",
        scope: "VIRTUAL_GUESTS",
      },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  const active = guests.filter((guest) => guest.active);
  const vms = active.filter((guest) => guest.assetType === "VM");
  const lxcs = active.filter((guest) => guest.assetType === "LXC");
  const running = active.filter((guest) =>
    ["RUNNING", "ONLINE"].includes(guest.status),
  );

  return (
    <>
      <section className="virtual-discovery-kpis">
        <article>
          <span>Virtual Guests</span>
          <strong>{active.length}</strong>
          <small>ativos descobertos</small>
        </article>
        <article>
          <span>VMs QEMU</span>
          <strong>{vms.length}</strong>
          <small>máquinas virtuais</small>
        </article>
        <article>
          <span>Containers LXC</span>
          <strong>{lxcs.length}</strong>
          <small>containers</small>
        </article>
        <article>
          <span>Em execução</span>
          <strong>{running.length}</strong>
          <small>RUNNING / ONLINE</small>
        </article>
        <article>
          <span>Último Virtual Discovery</span>
          <strong>{latestRun?.status ?? "—"}</strong>
          <small>{latestRun?.discovered ?? 0} recurso(s)</small>
        </article>
      </section>

      <section className="virtual-discovery-control">
        <div>
          <span>Sprint 015.6.2</span>
          <h2>Virtual Infrastructure Discovery</h2>
          <p>
            Descoberta de VMs QEMU e Containers LXC reais, relacionados ao Node
            físico que os hospeda e persistidos no InfrastructureAsset.
          </p>
        </div>
        <VirtualDiscoveryConsole />
      </section>

      <section className="virtual-discovery-section">
        <div className="virtual-discovery-heading">
          <div>
            <span>Digital Twin Virtual Layer</span>
            <h2>VMs e Containers reais</h2>
          </div>
          <small>{active.length} guest(s) ativo(s)</small>
        </div>

        {guests.length ? (
          <div className="virtual-guest-grid">
            {guests.map((guest) => {
              const metadata =
                guest.metadata && typeof guest.metadata === "object"
                  ? (guest.metadata as Record<string, unknown>)
                  : {};

              return (
                <article
                  key={guest.id}
                  className={!guest.active ? "is-inactive" : undefined}
                >
                  <div className="virtual-guest-top">
                    <span>{guest.assetType}</span>
                    <b
                      className={
                        ["RUNNING", "ONLINE"].includes(guest.status)
                          ? "is-healthy"
                          : guest.status === "STOPPED"
                            ? "is-warning"
                            : "is-error"
                      }
                    >
                      {guest.status}
                    </b>
                  </div>

                  <h3>{guest.name}</h3>
                  <small>
                    VMID {String(metadata.vmid ?? "—")} • Node{" "}
                    {guest.nodeName ?? "—"}
                  </small>

                  <div className="virtual-guest-health">
                    <div>
                      <span>CPU</span>
                      <strong>{formatPercent(guest.cpuPercent)}</strong>
                    </div>
                    <div>
                      <span>RAM</span>
                      <strong>{formatBytes(guest.memoryUsedBytes)}</strong>
                    </div>
                    <div>
                      <span>Disco</span>
                      <strong>{formatBytes(guest.diskUsedBytes)}</strong>
                    </div>
                  </div>

                  <dl>
                    <div><dt>vCPUs</dt><dd>{guest.cpuCores ?? "—"}</dd></div>
                    <div><dt>RAM total</dt><dd>{formatBytes(guest.memoryTotalBytes)}</dd></div>
                    <div><dt>Disco total</dt><dd>{formatBytes(guest.diskTotalBytes)}</dd></div>
                    <div><dt>Uptime</dt><dd>{formatUptime(guest.uptimeSeconds)}</dd></div>
                    <div><dt>Parent</dt><dd>{guest.parentExternalId ?? "—"}</dd></div>
                    <div><dt>Tags</dt><dd>{String(metadata.tags ?? "—")}</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="virtual-discovery-empty">
            Nenhuma VM ou Container foi descoberto ainda.
          </div>
        )}
      </section>
    </>
  );
}
