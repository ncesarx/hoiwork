import { IncidentReconciliationPanel } from "@/components/incidents/incident-reconciliation-panel";
import { DiscoveryLifecyclePanel } from "@/components/incidents/discovery-lifecycle-panel";

export const metadata = {
  title: "Incident Reconciliation | Portal Enterprise",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function IncidentReconciliationPage() {
  return (
    <>
      <section className="portal-heading">
        <span>Incident Intelligence</span>
        <h1>Lifecycle & Automated Reconciliation</h1>
        <p>
          Validação conservadora da recuperação de ativos antes da resolução
          automática de incidentes.
        </p>
      </section>

      <IncidentReconciliationPanel />

      <DiscoveryLifecyclePanel />
    </>
  );
}
