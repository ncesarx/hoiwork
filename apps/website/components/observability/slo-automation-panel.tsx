import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { SloAutomationConsole } from "@/components/observability/slo-automation-console";

function stateClass(value: string) {
  return `trend-alert trend-alert--${value.toLowerCase()}`;
}

export async function SloAutomationPanel() {
  const { organization } = await requireOrganization();

  const [config, alerts] = await Promise.all([
    prisma.notificationSloAutomationConfig.upsert({
      where: { organizationId: organization.id },
      update: {},
      create: {
        organizationId: organization.id,
        enabled: false,
        intervalMinutes: 15,
      },
    }),
    prisma.notificationSloTrendAlert.findMany({
      where: { organizationId: organization.id },
      orderBy: [
        { status: "asc" },
        { lastSeenAt: "desc" },
      ],
    }),
  ]);

  const open = alerts.filter((item) => item.status === "OPEN");

  return (
    <section className="slo-automation-panel">
      <div className="slo-automation-heading">
        <div>
          <span>Sprint 015.6.10.4</span>
          <h2>Scheduled SLO Capture & Trend Alerts</h2>
          <p>
            Captura histórica automática e alertas internos de tendência,
            isolados do Notification Engine para evitar loops de autoalerta.
          </p>
        </div>

        <div className="slo-automation-status">
          <strong>{config.enabled ? "ENABLED" : "DISABLED"}</strong>
          <small>{config.intervalMinutes} min</small>
        </div>
      </div>

      <SloAutomationConsole
        initial={{
          enabled: config.enabled,
          intervalMinutes: config.intervalMinutes,
          nocDegradedBelow: config.nocDegradedBelow,
          nocCriticalBelow: config.nocCriticalBelow,
          burnDegradedAt: config.burnDegradedAt,
          burnCriticalAt: config.burnCriticalAt,
        }}
      />

      <div className="slo-automation-kpis">
        <article>
          <span>Trend Alerts OPEN</span>
          <strong>{open.length}</strong>
        </article>
        <article>
          <span>Última execução</span>
          <strong>
            {config.lastRunAt
              ? config.lastRunAt.toLocaleString("pt-BR")
              : "Nunca"}
          </strong>
        </article>
        <article>
          <span>Último sucesso</span>
          <strong>
            {config.lastSuccessAt
              ? config.lastSuccessAt.toLocaleString("pt-BR")
              : "Nunca"}
          </strong>
        </article>
      </div>

      {config.lastError ? (
        <div className="slo-automation-error">{config.lastError}</div>
      ) : null}

      <div className="trend-alert-list">
        <div>
          <span>Internal Trend Alerts</span>
          <h3>Alertas de tendência</h3>
        </div>

        {alerts.map((alert) => (
          <article
            key={alert.id}
            className={alert.status === "RESOLVED" ? "is-resolved" : ""}
          >
            <div>
              <b className={stateClass(alert.severity)}>
                {alert.severity}
              </b>
              <strong>{alert.title}</strong>
              <small>{alert.metric}</small>
            </div>
            <span>{alert.currentValue ?? "N/D"}</span>
            <span>threshold {alert.threshold ?? "N/D"}</span>
            <em>{alert.status}</em>
          </article>
        ))}

        {!alerts.length ? (
          <div className="trend-alert-empty">
            Nenhum alerta de tendência registrado.
          </div>
        ) : null}
      </div>
    </section>
  );
}
