import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { AlertPolicyConsole } from "@/components/alerts/alert-policy-console";

export const metadata = {
  title: "Alerting & Escalation | Portal Enterprise",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AlertsPage() {
  const { organization } = await requireOrganization();

  const [policies, deliveries] = await Promise.all([
    prisma.alertPolicy.findMany({
      where: { organizationId: organization.id },
      orderBy: { name: "asc" },
    }),
    prisma.alertDelivery.findMany({
      where: { organizationId: organization.id },
      include: { incident: true, policy: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <>
      <section className="portal-heading">
        <span>Operational Alerting</span>
        <h1>Alerting, Notification Policy & Escalation</h1>
        <p>
          Políticas de notificação e escalonamento calculadas sobre incidentes,
          severidade, risco e blast radius do Digital Twin.
        </p>
      </section>

      <AlertPolicyConsole />

      <section className="alert-kpis">
        <article><span>Políticas</span><strong>{policies.length}</strong></article>
        <article><span>Ativas</span><strong>{policies.filter((p)=>p.enabled).length}</strong></article>
        <article><span>Entregas</span><strong>{deliveries.length}</strong></article>
        <article><span>Simuladas</span><strong>{deliveries.filter((d)=>d.status==="SIMULATED").length}</strong></article>
      </section>

      <section className="alert-policies">
        <div className="alert-section-heading"><span>Notification Policies</span><h2>Políticas configuradas</h2></div>
        {policies.map((policy)=>(
          <article key={policy.id}>
            <div><h3>{policy.name}</h3><b>{policy.minSeverity}+</b></div>
            <p>{policy.channels.join(", ")} → {policy.recipients.join(", ")}</p>
            <small>Escala após {policy.escalateAfterMinutes} min · Repetição {policy.repeatEveryMinutes} min</small>
          </article>
        ))}
        {!policies.length ? <div className="alert-empty">Nenhuma política criada.</div> : null}
      </section>

      <section className="alert-deliveries">
        <div className="alert-section-heading"><span>Delivery Ledger</span><h2>Fila e histórico de notificações</h2></div>
        {deliveries.map((delivery)=>(
          <article key={delivery.id}>
            <div>
              <b>{delivery.channel}</b>
              <strong>{delivery.incident.severity} · {delivery.incident.assetName}</strong>
              <small>{delivery.recipient}</small>
            </div>
            <span>{delivery.policy?.name ?? "Policy removida"}</span>
            <span>Tentativa {delivery.attempt}</span>
            <em>{delivery.status}</em>
          </article>
        ))}
        {!deliveries.length ? <div className="alert-empty">Nenhuma entrega registrada.</div> : null}
      </section>
    </>
  );
}
