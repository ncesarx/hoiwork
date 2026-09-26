import { requireOrganization } from "@/lib/authz";
import { getAutonomousGovernanceStatus } from "@/lib/governance/autonomous-recovery-audit";
import { prisma } from "@/lib/prisma";
import { AutonomousGovernanceConfigForm } from "./autonomous-governance-config-form";
import { AutonomousGovernanceRunButton } from "./autonomous-governance-run-button";

type CapabilityDecisionSummary = {
  capability: string;
  candidateDecision: string;
  effectiveDecision: string;
  reasons: string[];
};

function readCapabilityDecisions(metadata: unknown): CapabilityDecisionSummary[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const entries = (metadata as Record<string, unknown>).capabilityDecisions;
  if (!Array.isArray(entries)) return [];

  return entries.flatMap((entry): CapabilityDecisionSummary[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    if (
      typeof item.capability !== "string" ||
      typeof item.candidateDecision !== "string" ||
      typeof item.effectiveDecision !== "string" ||
      !Array.isArray(item.reasons) ||
      !item.reasons.every((reason: unknown) => typeof reason === "string")
    ) return [];

    return [{
      capability: item.capability,
      candidateDecision: item.candidateDecision,
      effectiveDecision: item.effectiveDecision,
      reasons: item.reasons as string[],
    }];
  });
}

function utc(value: Date | null) {
  return value
    ? `${value.toLocaleString("pt-BR", { timeZone: "UTC" })} UTC`
    : "Nunca";
}

export async function AutonomousGovernancePanel() {
  const { session, organization } = await requireOrganization();
  const { automation } = await getAutonomousGovernanceStatus(organization.id);
  const config = automation.config;
  const latestRun = automation.lastRun;
  const decisions = latestRun?.status === "COMPLETED"
    ? readCapabilityDecisions(latestRun.metadata)
    : [];
  const canRun = ["ADMIN", "TECHNICIAN"].includes(session.user.role);
  const isAdmin = session.user.role === "ADMIN";
  const changes = isAdmin
    ? await prisma.autonomousGovernanceAutomationConfigChange.findMany({
        where: { organizationId: organization.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];
  const actors = changes.length
    ? await prisma.user.findMany({
        where: { id: { in: changes.map((change) => change.actorUserId) } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const actorNames = new Map(actors.map((actor) => [actor.id, actor.name ?? actor.email]));

  return (
    <section className="autonomous-governance-panel" aria-labelledby="autonomous-governance-title">
      <div className="autonomous-governance-heading">
        <div>
          <span>Autonomous Governance</span>
          <h2 id="autonomous-governance-title">Automação e histórico</h2>
          <p>Decisões, saúde e execuções recentes da organização.</p>
        </div>
        <strong className="autonomous-governance-mode">{automation.currentMode}</strong>
      </div>

      <div className="autonomous-governance-metrics">
        <article><span>Saúde</span><strong>{automation.health}</strong></article>
        <article><span>Scheduler</span><strong>{config?.enabled ? "Ativo" : "Inativo"}</strong></article>
        <article><span>Intervalo</span><strong>{config?.intervalMinutes ?? 5} min</strong></article>
        <article><span>Último sucesso</span><strong>{utc(config?.lastSuccessAt ?? null)}</strong></article>
        <article><span>Último scheduler</span><strong>{utc(automation.lastSchedulerRunAt)}</strong></article>
      </div>

      {config?.lastError ? (
        <p className="autonomous-governance-error" role="alert">Última falha: {config.lastError}</p>
      ) : null}

      {automation.overdue ? (
        <p className="autonomous-governance-error" role="alert">
          Scheduler atrasado: nenhuma execução registrada há mais de dois intervalos. Verifique o agendamento e os logs do HOIWORK.
        </p>
      ) : null}

      {canRun ? <AutonomousGovernanceRunButton /> : null}

      {isAdmin ? (
        <AutonomousGovernanceConfigForm
          enabled={config?.enabled ?? false}
          intervalMinutes={config?.intervalMinutes ?? 5}
        />
      ) : null}

      {isAdmin && changes.length ? (
        <div className="autonomous-governance-history">
          <h3>Alterações de configuração</h3>
          <div className="autonomous-governance-table-wrap">
            <table>
              <thead><tr><th>Data (UTC)</th><th>ADMIN</th><th>Scheduler</th><th>Intervalo</th></tr></thead>
              <tbody>
                {changes.map((change) => (
                  <tr key={change.id}>
                    <td>{utc(change.createdAt)}</td>
                    <td>{actorNames.get(change.actorUserId) ?? change.actorUserId}</td>
                    <td>{change.previousEnabled ? "Ativo" : "Inativo"} → {change.enabled ? "Ativo" : "Inativo"}</td>
                    <td>{change.previousIntervalMinutes} → {change.intervalMinutes} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {latestRun && decisions.length > 0 ? (
        <div className="autonomous-governance-history">
          <h3>Motivos da última avaliação</h3>
          <p>{utc(latestRun.startedAt)} · {latestRun.mode}. Os códigos abaixo registram os motivos calculados pelo motor.</p>
          <div className="autonomous-governance-table-wrap">
            <table>
              <thead><tr><th>Capability</th><th>Candidata</th><th>Efetiva</th><th>Motivos</th></tr></thead>
              <tbody>
                {decisions.map((decision) => (
                  <tr key={decision.capability}>
                    <td>{decision.capability}</td>
                    <td>{decision.candidateDecision}</td>
                    <td>{decision.effectiveDecision}</td>
                    <td className="autonomous-governance-reasons">
                      {decision.reasons.length ? decision.reasons.join(", ") : "Nenhum motivo da avaliação candidata"}
                      {decision.candidateDecision !== decision.effectiveDecision ? " · Transição pendente de histerese" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="autonomous-governance-history">
        <h3>Últimas execuções</h3>
        {automation.runs.length ? (
          <div className="autonomous-governance-table-wrap">
            <table>
              <thead><tr><th>Início (UTC)</th><th>Origem</th><th>Modo</th><th>Estado</th><th>Capabilities</th><th>Bloqueadas</th></tr></thead>
              <tbody>
                {automation.runs.map((run) => (
                  <tr key={run.id}>
                    <td>{utc(run.startedAt)}</td>
                    <td>{run.source}</td>
                    <td>{run.mode}</td>
                    <td>{run.status}</td>
                    <td>{run.capabilities}</td>
                    <td>{run.blocked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>Nenhuma execução registrada.</p>}
      </div>
    </section>
  );
}
