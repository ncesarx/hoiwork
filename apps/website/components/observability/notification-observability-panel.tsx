import { requireOrganization } from "@/lib/authz";
import { buildNotificationObservability } from "@/lib/observability/notification-slo";

function stateClass(state: string) {
  return `obs-state obs-state--${state.toLowerCase().replace("_", "-")}`;
}

function fmtPct(value: number | null) {
  return value === null ? "N/D" : `${value.toFixed(2)}%`;
}

function fmtMs(value: number | null) {
  if (value === null) return "N/D";
  if (value < 1000) return `${value} ms`;
  if (value < 60000) return `${(value / 1000).toFixed(2)} s`;

  const minutes = Math.floor(value / 60000);
  const seconds = Math.round((value % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export async function NotificationObservabilityPanel() {
  const { organization } = await requireOrganization();
  const data = await buildNotificationObservability(organization.id);

  const windows = [
    ["1 hora", data.delivery.h1, data.automation.h1],
    ["24 horas", data.delivery.h24, data.automation.h24],
    ["7 dias", data.delivery.d7, data.automation.d7],
  ] as const;

  return (
    <section className="notification-observability">
      <div className="notification-observability__heading">
        <div>
          <span>Sprint 015.6.10.1b</span>
          <h2>Notification Observability & SLO</h2>
          <p>
            Observabilidade passiva com decomposição de latência entre fila/governança,
            transporte e tempo end-to-end.
          </p>
        </div>

        <div className={stateClass(data.overall)}>
          <small>Overall</small>
          <strong>{data.overall}</strong>
        </div>
      </div>

      <div className="observability-slo-strip">
        <article>
          <span>Delivery SLO</span>
          <strong>{data.slo.deliverySuccessTarget}%</strong>
        </article>
        <article>
          <span>Retry máximo</span>
          <strong>{data.slo.retryRateTargetMax}%</strong>
        </article>
        <article>
          <span>Automation failures</span>
          <strong>{data.slo.automationFailureTarget}</strong>
        </article>
        <article>
          <span>Connector score</span>
          <strong>
            {data.connectors.averageScore === null
              ? "N/D"
              : `${data.connectors.averageScore}/100`}
          </strong>
        </article>
      </div>

      <div className="observability-window-grid">
        {windows.map(([label, delivery, automation]) => (
          <article key={label} className="observability-window-card">
            <header>
              <h3>{label}</h3>
              <span className={stateClass(delivery.successState)}>
                {delivery.successState}
              </span>
            </header>

            <dl>
              <div>
                <dt>Success rate</dt>
                <dd>{fmtPct(delivery.successRate)}</dd>
              </div>
              <div>
                <dt>Failure rate</dt>
                <dd>{fmtPct(delivery.failureRate)}</dd>
              </div>
              <div>
                <dt>Retry rate</dt>
                <dd>{fmtPct(delivery.retryRate)}</dd>
              </div>
              <div>
                <dt>Transport avg</dt>
                <dd>{fmtMs(delivery.latency.transportAvgMs)}</dd>
              </div>
              <div>
                <dt>Queue/Governance avg</dt>
                <dd>{fmtMs(delivery.latency.queueGovernanceAvgMs)}</dd>
              </div>
              <div>
                <dt>End-to-End avg</dt>
                <dd>{fmtMs(delivery.latency.endToEndAvgMs)}</dd>
              </div>
              <div>
                <dt>Telemetry samples</dt>
                <dd>{delivery.latency.measuredDeliveries}</dd>
              </div>
              <div>
                <dt>Legacy E2E avg</dt>
                <dd>{fmtMs(delivery.latency.legacyEndToEndAvgMs)}</dd>
              </div>
              <div>
                <dt>Automation</dt>
                <dd className={stateClass(automation.state)}>
                  {automation.state}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <section className="connector-observability">
        <div className="connector-observability__heading">
          <span>Connector Health</span>
          <h3>Conectores monitorados</h3>
        </div>

        {data.connectors.items.map((connector) => (
          <article key={connector.id}>
            <div>
              <b>{connector.type}</b>
              <strong>{connector.name}</strong>
              <small>{connector.mode}</small>
            </div>

            <span>{connector.lastTestStatus ?? "NÃO TESTADO"}</span>

            <span>
              {connector.lastTestAt
                ? connector.lastTestAt.toLocaleString("pt-BR")
                : "Nunca"}
            </span>

            <strong>{connector.score}/100</strong>

            <em className={stateClass(connector.state)}>
              {connector.state}
            </em>
          </article>
        ))}
      </section>

      <div className="observability-footnote">
        <span>
          Última entrega bem-sucedida:{" "}
          {data.delivery.lastSuccessfulDeliveryAt
            ? data.delivery.lastSuccessfulDeliveryAt.toLocaleString("pt-BR")
            : "Nunca"}
        </span>
        <span>
          Telemetria de transporte é coletada apenas em novas entregas após a
          Sprint 015.6.10.1b. Registros anteriores permanecem como Legacy E2E.
        </span>
      </div>
    </section>
  );
}
