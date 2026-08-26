import { requireOrganization } from "@/lib/authz";
import { getSloTrend } from "@/lib/observability/slo-snapshots";

function fmt(value: number | null, suffix = "") {
  return value === null ? "N/D" : `${value.toFixed(2)}${suffix}`;
}

function trend(value: number | null) {
  if (value === null) return "N/D";
  if (value > 0) return `+${value.toFixed(2)}`;
  return value.toFixed(2);
}

export async function SloTrendPanel() {
  const { organization } = await requireOrganization();
  const data = await getSloTrend(organization.id);

  return (
    <section className="slo-trend-panel">
      <div className="slo-trend-heading">
        <div>
          <span>Sprint 015.6.10.3</span>
          <h2>SLO Snapshot History & Trend Intelligence</h2>
          <p>
            Histórico persistente de saúde do NOC, error budget e burn rate para
            acompanhar tendência e degradação ao longo do tempo.
          </p>
        </div>
        <div className="slo-trend-count">
          <strong>{data.series.length}</strong>
          <small>snapshots</small>
        </div>
      </div>

      <div className="slo-trend-kpis">
        <article>
          <span>NOC Health Δ</span>
          <strong>{trend(data.deltas.nocHealthScore)}</strong>
        </article>
        <article>
          <span>Delivery 24h Δ</span>
          <strong>{trend(data.deltas.deliverySuccess24h)}</strong>
        </article>
        <article>
          <span>Error Budget 24h Δ</span>
          <strong>{trend(data.deltas.errorBudget24h)}</strong>
        </article>
        <article>
          <span>Burn Rate 1h Δ</span>
          <strong>{trend(data.deltas.burnRate1h)}</strong>
        </article>
      </div>

      <div className="slo-trend-history">
        <div className="slo-trend-history__heading">
          <span>Historical SLO</span>
          <h3>Últimos snapshots</h3>
        </div>

        {data.series.slice(-20).reverse().map((item) => (
          <article key={item.id}>
            <div>
              <b>{item.overallState}</b>
              <strong>{item.nocHealthScore ?? "N/D"}/100</strong>
              <small>{item.capturedAt.toLocaleString("pt-BR")}</small>
            </div>
            <span>Delivery {fmt(item.deliverySuccess24h, "%")}</span>
            <span>Retry {fmt(item.retryRate24h, "%")}</span>
            <span>Budget {fmt(item.errorBudget24h, "%")}</span>
            <span>Burn {fmt(item.burnRate1h, "x")}</span>
            <span>Connector {item.connectorScore ?? "N/D"}</span>
          </article>
        ))}

        {!data.series.length ? (
          <div className="slo-trend-empty">
            Nenhum snapshot capturado ainda.
          </div>
        ) : null}
      </div>
    </section>
  );
}
