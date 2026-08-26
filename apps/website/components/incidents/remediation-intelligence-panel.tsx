import { requireOrganization } from "@/lib/authz";
import { buildRemediationIntelligence } from "@/lib/incidents/remediation-intelligence";
export async function RemediationIntelligencePanel({ incidentId }: { incidentId: string }) {
  const { organization } = await requireOrganization();
  const data = await buildRemediationIntelligence(organization.id, incidentId);
  if (!data) return null;
  const r=data.recommendation;
  return <section className="remediation-intelligence-panel">
    <div className="remediation-intelligence-heading"><div><span>Sprint 015.6.11.5.1</span><h2>Operations Intelligence & Remediation Readiness</h2><p>Recomendação segura baseada no incidente e no estado atual do ativo. Execução real permanece bloqueada.</p></div><div className={`remediation-safety is-${r.safetyClass.toLowerCase()}`}><span>Safety Class</span><strong>{r.safetyClass}</strong></div></div>
    <div className="remediation-kpis"><article><span>Recommended Action</span><strong>{r.action}</strong></article><article><span>Risk</span><strong>{r.risk}</strong></article><article><span>Recovery Evidence</span><strong>{data.evidence.recoveryEvidence}</strong></article><article><span>Open SLA Breaches</span><strong>{data.evidence.openSlaBreaches}</strong></article></div>
    <div className="remediation-grid"><section><span>Recommendation</span><h3>{r.title}</h3><p>{r.rationale}</p><dl><div><dt>Real execution</dt><dd>DISABLED</dd></div><div><dt>Dry-run only</dt><dd>YES</dd></div><div><dt>Approval required</dt><dd>{r.requiresApproval?"YES":"NO"}</dd></div><div><dt>Executable now</dt><dd>NO</dd></div></dl></section><section><span>Verification Plan</span><h3>Como provar recuperação</h3>{r.verification.map((item,i)=><p key={i}>{i+1}. {item}</p>)}</section><section><span>Safety Blockers</span><h3>Restrições atuais</h3>{r.blockers.length?r.blockers.map(b=><b key={b}>{b}</b>):<p>Nenhum blocker adicional; execução segue globalmente desabilitada nesta fase.</p>}</section></div>
  </section>;
}
