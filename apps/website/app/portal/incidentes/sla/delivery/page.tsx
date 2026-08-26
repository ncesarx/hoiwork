import { SlaDeliveryObservabilityPanel } from "@/components/incidents/sla-delivery-observability-panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SlaDeliveryObservabilityPage() {
  return (
    <>
      <section className="portal-heading">
        <span>Incident Operations</span>
        <h1>SLA Delivery Observability</h1>
        <p>
          Visibilidade operacional da jornada entre escalonamento e entrega de
          notificações.
        </p>
      </section>

      <SlaDeliveryObservabilityPanel />
    </>
  );
}
