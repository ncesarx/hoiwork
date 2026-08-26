import { requireOrganization } from "@/lib/authz";
import { buildSlaDeliveryObservability } from "@/lib/incidents/sla-delivery-observability";

function fmtSeconds(value: number | null) {
  if (value === null) return "N/D";
  if (value < 60) return `${value.toFixed(2)} s`;
  const min = Math.floor(value / 60);
  const sec = Math.round(value % 60);
  return `${min}m ${sec}s`;
}

function fmtPct(value: number | null) {
  return value === null ? "N/D" : `${value.toFixed(2)}%`;
}

export async function SlaDeliveryObservabilityPanel() {
  const { organization } = await requireOrganization();
  const data = await buildSlaDeliveryObservability(organization.id, 100);

  return (
    <section className="sla-delivery-panel">
      <div className="sla-delivery-heading">
        <div>
          <span>Sprint 015.6.11.3.3</span>
          <h2>SLA Escalation Delivery & Operational Observability</h2>
          <p>
            Correlação ponta a ponta entre SLA Breach, escalonamento e
            AlertDelivery, com estado, tentativas, erros e latência.
          </p>
        </div>
        <div className={`sla-delivery-overall is-${data.overall.toLowerCase()}`}>
          <span>Overall</span>
          <strong>{data.overall}</strong>
        </div>
      </div>

      <div className="sla-delivery-kpis">
        <article>
          <span>Escalations</span>
          <strong>{data.counters.escalations}</strong>
        </article>
        <article>
          <span>Deliveries</span>
          <strong>{data.counters.deliveries}</strong>
        </article>
        <article>
          <span>Success rate</span>
          <strong>{fmtPct(data.metrics.deliverySuccessRate)}</strong>
        </article>
        <article>
          <span>Avg latency</span>
          <strong>{fmtSeconds(data.metrics.avgLatencySeconds)}</strong>
        </article>
        <article>
          <span>Pending</span>
          <strong>{data.counters.pending}</strong>
        </article>
        <article>
          <span>SENT</span>
          <strong>{data.counters.sent}</strong>
        </article>
        <article>
          <span>SIMULATED</span>
          <strong>{data.counters.simulated}</strong>
        </article>
        <article>
          <span>FAILED</span>
          <strong>{data.counters.failed}</strong>
        </article>
      </div>

      <div className="sla-delivery-table">
        <div className="sla-delivery-table-heading">
          <span>Escalation → Delivery</span>
          <h3>Operational Delivery Trail</h3>
        </div>

        {data.rows.map((row) => (
          <article key={row.escalationId}>
            <div className="sla-delivery-summary">
              <div>
                <b>{row.breachType}</b>
                <strong>{row.title}</strong>
                <small>
                  {row.assetName} · {row.site ?? "N/D"}
                </small>
              </div>

              <span>{row.severity}</span>
              <span>{row.escalationStatus}</span>
              <span>{row.lastStatus}</span>
              <span>{row.deliveriesTotal} delivery(s)</span>
              <span>{fmtSeconds(row.avgLatencySeconds)}</span>
            </div>

            <div className="sla-delivery-detail">
              {row.deliveries.map((delivery) => (
                <div key={delivery.id}>
                  <span>{delivery.channel}</span>
                  <span>{delivery.recipient}</span>
                  <span>{delivery.status}</span>
                  <span>attempt {delivery.attempt}</span>
                  <span>{fmtSeconds(delivery.latencySeconds)}</span>
                  <span>{delivery.policyName ?? "N/D"}</span>
                  <small>{delivery.errorMessage ?? "sem erro"}</small>
                </div>
              ))}

              {!row.deliveries.length ? (
                <small className="sla-delivery-no-data">
                  Escalonamento ainda sem AlertDelivery correlacionado.
                </small>
              ) : null}

              {row.lastError ? (
                <div className="sla-delivery-error">
                  Último erro: {row.lastError}
                </div>
              ) : null}
            </div>
          </article>
        ))}

        {!data.rows.length ? (
          <div className="sla-delivery-empty">
            Nenhum escalonamento SLA encontrado.
          </div>
        ) : null}
      </div>
    </section>
  );
}
