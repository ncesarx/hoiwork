import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { DiscoveryAutomationConsole } from "@/components/discovery/discovery-automation-console";

export async function DiscoveryAutomationPanel() {
  const { organization } = await requireOrganization();

  const [config, runs] = await Promise.all([
    prisma.discoveryAutomationConfig.upsert({
      where: { organizationId: organization.id },
      update: {},
      create: {
        organizationId: organization.id,
        enabled: false,
        intervalMinutes: 5,
        reconciliationEnabled: false,
      },
    }),
    prisma.discoveryAutomationRun.findMany({
      where: { organizationId: organization.id },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <section className="discovery-automation-panel">
      <div className="discovery-automation-heading">
        <div>
          <span>Sprint 015.6.11.2.1</span>
          <h2>Automated Infrastructure Discovery</h2>
          <p>
            Multi-Proxmox Discovery com closed-loop opcional para Incident
            Lifecycle. A reconciliação nasce desabilitada e só usa Discovery
            totalmente COMPLETED como evidência.
          </p>
        </div>

        <div className="discovery-automation-status">
          <strong>{config.enabled ? "ENABLED" : "DISABLED"}</strong>
          <small>
            Lifecycle {config.reconciliationEnabled ? "ENABLED" : "DISABLED"}
          </small>
        </div>
      </div>

      <DiscoveryAutomationConsole
        enabled={config.enabled}
        intervalMinutes={config.intervalMinutes}
        reconciliationEnabled={config.reconciliationEnabled}
      />

      <div className="discovery-automation-kpis">
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
          <span>Falhas consecutivas</span>
          <strong>{config.consecutiveFailures}</strong>
        </article>
      </div>

      {config.lastError ? (
        <div className="discovery-automation-error">{config.lastError}</div>
      ) : null}

      <div className="discovery-automation-history">
        <div>
          <span>Automation Runs</span>
          <h3>Histórico</h3>
        </div>

        {runs.map((run) => (
          <article key={run.id}>
            <div>
              <b>{run.source}</b>
              <strong>{run.status}</strong>
              <small>{run.startedAt.toLocaleString("pt-BR")}</small>
            </div>
            <span>{run.succeeded}/{run.instancesTotal} OK</span>
            <span>{run.failed} failed</span>
            <span>{run.assetsDiscovered} assets</span>
            <span>{run.durationMs ?? 0} ms</span>
          </article>
        ))}

        {!runs.length ? (
          <div className="discovery-automation-empty">
            Nenhuma execução registrada.
          </div>
        ) : null}
      </div>
    </section>
  );
}
