import { IncidentSlaPanel } from "@/components/incidents/incident-sla-panel";
import { SlaDeliveryObservabilityPanel } from "@/components/incidents/sla-delivery-observability-panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function IncidentSlaPage() {
  return (
    <>
      <section className="portal-heading">
        <span>Incident Operations</span>
        <h1>SLA Breach & Escalation</h1>
        <p>Motor operacional para reconhecimento, resolução e escalonamento de incidentes fora do SLA.</p>
      </section>
      <IncidentSlaPanel />

      <SlaDeliveryObservabilityPanel />
    </>
  );
}
