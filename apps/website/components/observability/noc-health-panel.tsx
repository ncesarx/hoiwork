import { requireOrganization } from "@/lib/authz";
import { buildNocHealthModel } from "@/lib/observability/noc-health";

function cls(state: string) {
  return `noc-state noc-state--${state.toLowerCase().replace("_", "-")}`;
}

function fmtPct(value: number | null) {
  return value === null ? "N/D" : `${value.toFixed(2)}%`;
}

function fmtBurn(value: number | null) {
  return value === null ? "N/D" : `${value.toFixed(2)}x`;
}

export async function NocHealthPanel() {
  const { organization } = await requireOrganization();
  const data = await buildNocHealthModel(organization.id);

  const windows = [
    ["1 hora", data.windows.h1],
    ["24 horas", data.windows.h24],
    ["7 dias", data.windows.d7],
  ] as const;

  return (
    <section className="noc-health-panel">
      <div className="noc-health-heading">
        <div>
          <span>Sprint 015.6.10.2</span>
          <h2>Error Budget, Burn Rate & NOC Health</h2>
          <p>
            Modelo passivo de saúde operacional baseado em SLO de entrega,
            retry, automação e conectores.
          </p>
        </div>

        <div className={cls(data.state)}>
          <small>NOC Health</small>
          <strong>
            {data.nocHealthScore === null ? "N/D" : `${data.nocHealthScore}/100`}
          </strong>
          <em>{data.state}</em>
        </div>
      </div>

      <div className="noc-component-grid">
        <article>
          <span>Delivery</span>
          <strong>{data.components.deliveryScore ?? "N/D"}</strong>
        </article>
        <article>
          <span>Retry</span>
          <strong>{data.components.retryScore ?? "N/D"}</strong>
        </article>
        <article>
          <span>Automation</span>
          <strong>{data.components.automationScore ?? "N/D"}</strong>
        </article>
        <article>
          <span>Connector</span>
          <strong>{data.components.connectorScore ?? "N/D"}</strong>
        </article>
      </div>

      <div className="noc-budget-grid">
        {windows.map(([label, window]) => (
          <article key={label}>
            <header>
              <h3>{label}</h3>
              <span>{fmtPct(window.successRate)}</span>
            </header>

            <dl>
              <div>
                <dt>Error budget remaining</dt>
                <dd>{fmtPct(window.errorBudgetRemaining)}</dd>
              </div>
              <div>
                <dt>Burn rate</dt>
                <dd>{fmtBurn(window.burnRate)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className={`noc-burn-banner ${cls(data.burnState)}`}>
        <span>Burn-rate state</span>
        <strong>{data.burnState}</strong>
        <small>
          1h burn &lt; 2x = saudável · 2–9.99x = degradado · ≥10x = crítico
        </small>
      </div>
    </section>
  );
}
