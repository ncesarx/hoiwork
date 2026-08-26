import { requireOrganization } from "@/lib/authz";
import { buildMultiSiteTopology } from "@/lib/discovery/multisite-topology";

function statusClass(status: string) {
  return status === "HEALTHY" || status === "ONLINE" || status === "RUNNING" || status === "AVAILABLE"
    ? "is-healthy"
    : status === "ERROR" || status === "OFFLINE" || status === "MISSING"
      ? "is-error"
      : "is-warning";
}

export async function MultiSiteTopologyPanel() {
  const { organization } = await requireOrganization();
  const topology = await buildMultiSiteTopology(organization.id);

  return (
    <section className="multisite-topology">
      <div className="multisite-topology__heading">
        <div>
          <span>Registry Consolidation</span>
          <h2>Multi-Site Topology</h2>
          <p>
            Cada site Proxmox possui identidade própria e topologia isolada,
            consolidada em uma visão única do HOIWORK.
          </p>
        </div>

        <div className="multisite-topology__totals">
          <strong>{topology.totals.instances}</strong>
          <small>instâncias</small>
          <strong>{topology.totals.assets}</strong>
          <small>ativos</small>
        </div>
      </div>

      <div className="multisite-topology__kpis">
        <article><span>Instâncias saudáveis</span><strong>{topology.totals.healthyInstances}/{topology.totals.instances}</strong></article>
        <article><span>Nodes</span><strong>{topology.totals.nodes}</strong></article>
        <article><span>VMs</span><strong>{topology.totals.vms}</strong></article>
        <article><span>LXCs</span><strong>{topology.totals.lxcs}</strong></article>
        <article><span>Storages</span><strong>{topology.totals.storages}</strong></article>
        <article><span>Networks</span><strong>{topology.totals.networks}</strong></article>
      </div>

      <div className="multisite-site-grid">
        {topology.sites.map((site) => (
          <article key={site.instance.id} className="multisite-site-card">
            <header>
              <div>
                <span>{site.instance.site || "SITE"}</span>
                <h3>{site.instance.name}</h3>
                <small>{site.instance.baseUrl}</small>
              </div>
              <b className={statusClass(site.instance.status)}>{site.instance.status}</b>
            </header>

            <div className="multisite-site-card__stats">
              <span>Nodes <strong>{site.counts.nodes}</strong></span>
              <span>VMs <strong>{site.counts.vms}</strong></span>
              <span>LXCs <strong>{site.counts.lxcs}</strong></span>
              <span>Storage <strong>{site.counts.storages}</strong></span>
              <span>Network <strong>{site.counts.networks}</strong></span>
            </div>

            <div className="multisite-site-card__nodes">
              {site.groups.map((group) => (
                <section key={group.nodeExternalId}>
                  <div className="multisite-node-root">
                    <span>NODE</span>
                    <strong>{group.nodeName}</strong>
                  </div>

                  <div className="multisite-node-children">
                    <div>
                      <b>COMPUTE</b>
                      {group.guests.map((asset) => (
                        <span key={asset.externalId}>
                          <i className={statusClass(asset.status)} />
                          {asset.type} · {asset.name}
                        </span>
                      ))}
                      {!group.guests.length ? <small>Sem guests</small> : null}
                    </div>

                    <div>
                      <b>STORAGE</b>
                      {group.storages.map((asset) => (
                        <span key={asset.externalId}>
                          <i className={statusClass(asset.status)} />
                          {asset.name}
                        </span>
                      ))}
                      {!group.storages.length ? <small>Sem storages</small> : null}
                    </div>

                    <div>
                      <b>NETWORK</b>
                      {group.networks.map((asset) => (
                        <span key={asset.externalId}>
                          <i className={statusClass(asset.status)} />
                          {asset.name}
                        </span>
                      ))}
                      {!group.networks.length ? <small>Sem interfaces</small> : null}
                    </div>
                  </div>
                </section>
              ))}

              {!site.groups.length ? (
                <div className="multisite-empty">Nenhum Node descoberto neste site.</div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
