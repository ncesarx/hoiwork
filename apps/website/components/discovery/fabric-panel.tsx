import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/authz";
import { FabricDiscoveryConsole } from "@/components/discovery/fabric-discovery-console";

function formatBytes(value: bigint | null | undefined) {
  if (value == null) {
    return "—";
  }

  let size = Number(value);

  if (!Number.isFinite(size)) {
    return "—";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  return `${size.toFixed(unit >= 3 ? 1 : 0)} ${units[unit]}`;
}

function metadataValue(
  metadata: Record<string, unknown>,
  key: string,
  fallback = "—",
) {
  const value = metadata[key];

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  return String(value);
}

export async function FabricPanel() {
  const { organization } = await requireOrganization();

  const assets = await prisma.infrastructureAsset.findMany({
    where: {
      organizationId: organization.id,
      provider: "PROXMOX",
      assetType: {
        in: ["STORAGE", "NETWORK"],
      },
    },
    orderBy: [
      {
        assetType: "asc",
      },
      {
        name: "asc",
      },
    ],
  });

  const activeStorages = assets.filter(
    (asset) =>
      asset.assetType === "STORAGE" &&
      asset.active,
  );

  const activeNetworks = assets.filter(
    (asset) =>
      asset.assetType === "NETWORK" &&
      asset.active,
  );

  return (
    <>
      <section className="fabric-control">
        <div>
          <span>Sprint 015.6.3</span>

          <h2>Storage & Network Discovery</h2>

          <p>
            Mapeamento da camada de storage e do fabric de rede
            do ambiente Proxmox.
          </p>
        </div>

        <FabricDiscoveryConsole />
      </section>

      <section className="fabric-grid">
        <article>
          <span>Storages</span>

          <strong>{activeStorages.length}</strong>

          <small>recursos ativos</small>
        </article>

        <article>
          <span>Network Fabric</span>

          <strong>{activeNetworks.length}</strong>

          <small>interfaces e bridges</small>
        </article>
      </section>

      <section className="fabric-assets">
        {assets.map((asset) => {
          const metadata =
            asset.metadata &&
            typeof asset.metadata === "object" &&
            !Array.isArray(asset.metadata)
              ? (asset.metadata as Record<string, unknown>)
              : {};

          const isStorage =
            asset.assetType === "STORAGE";

          const isHealthy = [
            "ONLINE",
            "AVAILABLE",
            "ACTIVE",
          ].includes(asset.status);

          return (
            <article
              key={asset.id}
              className={!asset.active ? "is-inactive" : undefined}
            >
              <div>
                <b>{asset.assetType}</b>

                <em
                  className={
                    isHealthy
                      ? "is-healthy"
                      : "is-warning"
                  }
                >
                  {asset.status}
                </em>
              </div>

              <h3>{asset.name}</h3>

              <small>
                Node {asset.nodeName ?? "cluster"}
              </small>

              {isStorage ? (
                <>
                  <p>
                    {formatBytes(asset.diskUsedBytes)}
                    {" / "}
                    {formatBytes(asset.diskTotalBytes)}
                  </p>

                  <small>
                    Tipo:{" "}
                    {metadataValue(
                      metadata,
                      "storageType",
                    )}
                  </small>

                  <small>
                    Shared:{" "}
                    {metadata.shared === true
                      ? "Sim"
                      : "Não"}
                  </small>
                </>
              ) : (
                <>
                  <p>
                    {metadataValue(
                      metadata,
                      "interfaceType",
                      "interface",
                    )}
                    {" • "}
                    {metadataValue(
                      metadata,
                      "cidr",
                      metadataValue(
                        metadata,
                        "address",
                        "sem IP",
                      ),
                    )}
                  </p>

                  <small>
                    Bridge ports:{" "}
                    {metadataValue(
                      metadata,
                      "bridgePorts",
                    )}
                  </small>
                </>
              )}

              <small>
                Parent:{" "}
                {asset.parentExternalId ?? "cluster"}
              </small>
            </article>
          );
        })}
      </section>

      {!assets.length ? (
        <div className="fabric-discovery-empty">
          Nenhum Storage ou recurso de rede foi descoberto ainda.
        </div>
      ) : null}
    </>
  );
}
