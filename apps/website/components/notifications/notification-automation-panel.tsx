import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { NotificationAutomationConsole } from "@/components/notifications/notification-automation-console";

export async function NotificationAutomationPanel() {
  const { organization } = await requireOrganization();

  const [config, runs] = await Promise.all([
    prisma.notificationAutomationConfig.upsert({
      where: { organizationId: organization.id },
      update: {},
      create: {
        organizationId: organization.id,
        enabled: false,
        intervalMinutes: 5,
      },
    }),
    prisma.notificationAutomationRun.findMany({
      where: { organizationId: organization.id },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <section className="notification-automation-panel">
      <div className="notification-automation-heading">
        <div>
          <span>Sprint 015.6.9.3</span>
          <h2>Automated Scheduling</h2>
          <p>
            Ciclo único de Evaluate → Governance → Dispatch com lock de
            concorrência e histórico persistente.
          </p>
        </div>

        <div className="notification-automation-status">
          <strong>{config.enabled ? "ENABLED" : "DISABLED"}</strong>
          <small>{config.intervalMinutes} min</small>
        </div>
      </div>

      <NotificationAutomationConsole
        enabled={config.enabled}
        intervalMinutes={config.intervalMinutes}
      />

      <div className="automation-run-kpis">
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
        <article>
          <span>Runs</span>
          <strong>{runs.length}</strong>
        </article>
      </div>

      {config.lastError ? (
        <div className="automation-last-error">{config.lastError}</div>
      ) : null}

      <div className="automation-run-history">
        <div className="automation-run-history__heading">
          <span>Audit Trail</span>
          <h3>Automation Runs</h3>
        </div>

        {runs.map((run) => (
          <article key={run.id}>
            <div>
              <b>{run.source}</b>
              <strong>{run.status}</strong>
              <small>{run.startedAt.toLocaleString("pt-BR")}</small>
            </div>

            <span>{run.durationMs ?? 0} ms</span>
            <span>Alerts {run.alertsCreated}</span>
            <span>Sent {run.sent}</span>
            <span>Retry {run.retryPending}</span>
            <span>Failed {run.failed}</span>
          </article>
        ))}

        {!runs.length ? (
          <div className="automation-run-empty">
            Nenhum Automation Run registrado.
          </div>
        ) : null}
      </div>
    </section>
  );
}
